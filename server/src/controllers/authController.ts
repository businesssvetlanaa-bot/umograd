import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import {
  CHILD_LOGIN_ERROR,
  childLoginThrottle,
  hashChildPin,
  isValidChildPin,
  normalizeParentEmail,
  verifyChildPin,
} from '../services/childAccess'
import {
  DELETE_ACCOUNT_CONFIRMATION,
  confirmsAccountDeletion,
  isValidCurrentPassword,
  isValidNewPassword,
  parentAuthVersion,
  sensitiveActionThrottle,
} from '../services/accountSecurity'
import type { AuthRequest } from '../middleware/authMiddleware'


function signToken(payload: object, expiresIn = '30d') {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn } as jwt.SignOptions)
}

function signParentToken(user: { id: string; email: string; password: string }): string {
  return signToken({
    id: user.id,
    email: user.email,
    role: 'parent',
    authv: parentAuthVersion(process.env.JWT_SECRET!, user.id, user.password),
  })
}

// POST /api/auth/register
export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Заполните все поля' })
    return
  }

  const normalizedEmail = normalizeParentEmail(email)
  if (!normalizedEmail) {
    res.status(400).json({ error: 'Введите корректный email' })
    return
  }

  if (!isValidNewPassword(password)) {
    res.status(400).json({ error: '\u041f\u0430\u0440\u043e\u043b\u044c \u0434\u043e\u043b\u0436\u0435\u043d \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u043e\u0442 8 \u0434\u043e 72 \u0431\u0430\u0439\u0442' })
    return
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      res.status(409).json({ error: 'Этот email уже зарегистрирован' })
      return
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email: normalizedEmail, password: hashed },
    })

    const token = signParentToken(user)
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } })
  } catch {
    res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже' })
  }
}

// POST /api/auth/login
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body

  if (!email || !password) {
    res.status(400).json({ error: 'Введите email и пароль' })
    return
  }

  const normalizedEmail = normalizeParentEmail(email)
  if (!normalizedEmail) {
    res.status(401).json({ error: 'Неверный email или пароль' })
    return
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (!user) {
      res.status(401).json({ error: 'Неверный email или пароль' })
      return
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      res.status(401).json({ error: 'Неверный email или пароль' })
      return
    }

    const token = signParentToken(user)
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } })
  } catch {
    res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже' })
  }
}

// POST /api/auth/child-login
export async function childLogin(req: Request, res: Response): Promise<void> {
  const { child_id, pin } = req.body

  if (typeof child_id !== 'string' || !child_id.trim() || child_id.length > 128 || !isValidChildPin(pin)) {
    res.status(400).json({ error: 'Выберите профиль и введите PIN-код из 4 цифр' })
    return
  }

  const normalizedChildId = child_id.trim()
  const throttleKey = childLoginThrottle.key(req.ip, normalizedChildId)
  const retryAfter = childLoginThrottle.retryAfterSeconds(throttleKey)
  if (retryAfter !== null) {
    res.set('Retry-After', String(retryAfter))
    res.status(429).json({ error: 'Слишком много попыток. Попробуйте позже.' })
    return
  }

  try {
    const child = await prisma.child.findUnique({ where: { id: normalizedChildId } })
    const verification = await verifyChildPin(child?.pin ?? null, pin)
    if (!child || !verification.valid) {
      childLoginThrottle.recordFailure(throttleKey)
      res.status(401).json({ error: CHILD_LOGIN_ERROR })
      return
    }

    // обновляем last_active и стрик
    const now = new Date()
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)

    let newStreak = child.streak_days
    if (child.last_active) {
      const lastDate = new Date(child.last_active)
      const diffDays = Math.floor((now.getTime() - lastDate.getTime()) / 86400000)
      if (diffDays === 1) newStreak += 1
      else if (diffDays > 1) newStreak = 1
    } else {
      newStreak = 1
    }

    const migratedPin = verification.needsRehash ? await hashChildPin(pin) : undefined
    await prisma.child.update({
      where: { id: normalizedChildId },
      data: {
        last_active: now,
        streak_days: newStreak,
        ...(migratedPin ? { pin: migratedPin } : {}),
      },
    })
    childLoginThrottle.clear(throttleKey)

    const token = signToken({ id: child.id, role: 'child' })
    res.json({
      token,
      child: {
        id: child.id,
        name: child.name,
        avatar_type: child.avatar_type,
        avatar_color: child.avatar_color,
        xp: child.xp,
        level: child.level,
        coins: child.coins,
        streak_days: newStreak,
      },
    })
  } catch {
    res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже' })
  }
}

// GET /api/auth/me
export async function me(req: Request & { user?: { id: string; role: string } }, res: Response): Promise<void> {
  try {
    if (req.user?.role === 'parent') {
      const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, name: true, email: true, created_at: true },
      })
      if (!user) { res.status(401).json({ error: '\u0421\u0435\u0441\u0441\u0438\u044f \u0438\u0441\u0442\u0435\u043a\u043b\u0430. \u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u0441\u043d\u043e\u0432\u0430' }); return }
      res.json({ role: 'parent', user })
    } else if (req.user?.role === 'child') {
      const child = await prisma.child.findUnique({
        where: { id: req.user.id },
        select: { id: true, name: true, avatar_type: true, avatar_color: true, xp: true, level: true, coins: true, streak_days: true },
      })
      if (!child) { res.status(401).json({ error: '\u0421\u0435\u0441\u0441\u0438\u044f \u0438\u0441\u0442\u0435\u043a\u043b\u0430. \u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u0441\u043d\u043e\u0432\u0430' }); return }
      res.json({ role: 'child', child })
    } else {
      res.status(401).json({ error: 'Не авторизован' })
    }
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
}

// PUT /api/auth/password
export async function changePassword(req: AuthRequest, res: Response): Promise<void> {
  const { current_password, new_password } = req.body as { current_password?: unknown; new_password?: unknown }
  if (!isValidCurrentPassword(current_password) || !isValidNewPassword(new_password)) {
    res.status(400).json({ error: '\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c \u0434\u043e\u043b\u0436\u0435\u043d \u0441\u043e\u0434\u0435\u0440\u0436\u0430\u0442\u044c \u043e\u0442 8 \u0434\u043e 72 \u0431\u0430\u0439\u0442' })
    return
  }
  const parentId = req.user!.id
  const throttleKey = sensitiveActionThrottle.key(req.ip, parentId)
  const retryAfter = sensitiveActionThrottle.retryAfterSeconds(throttleKey)
  if (retryAfter !== null) {
    res.set('Retry-After', String(retryAfter))
    res.status(429).json({ error: '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.' })
    return
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: parentId } })
    const valid = user ? await bcrypt.compare(current_password, user.password) : false
    if (!user || !valid) {
      sensitiveActionThrottle.recordFailure(throttleKey)
      res.status(401).json({ error: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c' })
      return
    }
    if (await bcrypt.compare(new_password, user.password)) {
      sensitiveActionThrottle.clear(throttleKey)
      res.status(400).json({ error: '\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c \u0434\u043e\u043b\u0436\u0435\u043d \u043e\u0442\u043b\u0438\u0447\u0430\u0442\u044c\u0441\u044f \u043e\u0442 \u0442\u0435\u043a\u0443\u0449\u0435\u0433\u043e' })
      return
    }
    const password = await bcrypt.hash(new_password, 10)
    const result = await prisma.user.updateMany({ where: { id: parentId, password: user.password }, data: { password } })
    if (result.count !== 1) {
      res.status(409).json({ error: '\u0414\u0430\u043d\u043d\u044b\u0435 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430 \u0438\u0437\u043c\u0435\u043d\u0438\u043b\u0438\u0441\u044c. \u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.' })
      return
    }
    sensitiveActionThrottle.clear(throttleKey)
    res.json({ success: true, token: signParentToken({ ...user, password }) })
  } catch {
    res.status(500).json({ error: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435' })
  }
}

// DELETE /api/auth/account
export async function deleteAccount(req: AuthRequest, res: Response): Promise<void> {
  const { current_password, confirmation } = req.body as { current_password?: unknown; confirmation?: unknown }
  if (!isValidCurrentPassword(current_password) || !confirmsAccountDeletion(confirmation)) {
    res.status(400).json({ error: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c \u0438 \u0444\u0440\u0430\u0437\u0443 \u00ab' + DELETE_ACCOUNT_CONFIRMATION + '\u00bb' })
    return
  }
  const parentId = req.user!.id
  const throttleKey = sensitiveActionThrottle.key(req.ip, parentId)
  const retryAfter = sensitiveActionThrottle.retryAfterSeconds(throttleKey)
  if (retryAfter !== null) {
    res.set('Retry-After', String(retryAfter))
    res.status(429).json({ error: '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u043f\u043e\u043f\u044b\u0442\u043e\u043a. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.' })
    return
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: parentId } })
    const valid = user ? await bcrypt.compare(current_password, user.password) : false
    if (!user || !valid) {
      sensitiveActionThrottle.recordFailure(throttleKey)
      res.status(401).json({ error: '\u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u043f\u043e\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044c \u0442\u0435\u043a\u0443\u0449\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c' })
      return
    }
    const deleted = await prisma.$transaction((tx) => tx.user.deleteMany({ where: { id: parentId, password: user.password } }))
    if (deleted.count !== 1) {
      res.status(409).json({ error: '\u0414\u0430\u043d\u043d\u044b\u0435 \u0430\u043a\u043a\u0430\u0443\u043d\u0442\u0430 \u0438\u0437\u043c\u0435\u043d\u0438\u043b\u0438\u0441\u044c. \u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u043e\u043f\u044b\u0442\u043a\u0443.' })
      return
    }
    sensitiveActionThrottle.clearParent(parentId)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435' })
  }
}
