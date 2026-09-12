import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function signToken(payload: object, expiresIn = '30d') {
  return jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn } as jwt.SignOptions)
}

// POST /api/auth/register
export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body

  if (!name || !email || !password) {
    res.status(400).json({ error: 'Заполните все поля' })
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: 'Введите корректный email' })
    return
  }

  if (password.length < 8) {
    res.status(400).json({ error: 'Пароль должен быть не менее 8 символов' })
    return
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ error: 'Этот email уже зарегистрирован' })
      return
    }

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: { name, email, password: hashed },
    })

    const token = signToken({ id: user.id, email: user.email, role: 'parent' })
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

  try {
    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      res.status(401).json({ error: 'Неверный email или пароль' })
      return
    }

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) {
      res.status(401).json({ error: 'Неверный email или пароль' })
      return
    }

    const token = signToken({ id: user.id, email: user.email, role: 'parent' })
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } })
  } catch {
    res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже' })
  }
}

// POST /api/auth/child-login
export async function childLogin(req: Request, res: Response): Promise<void> {
  const { child_id, pin } = req.body

  if (!child_id) {
    res.status(400).json({ error: 'Выберите профиль ребёнка' })
    return
  }

  try {
    const child = await prisma.child.findUnique({ where: { id: child_id } })
    if (!child) {
      res.status(404).json({ error: 'Профиль не найден' })
      return
    }

    if (child.pin && child.pin !== (pin ?? '')) {
      res.status(401).json({ error: 'Неверный PIN-код' })
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

    await prisma.child.update({
      where: { id: child_id },
      data: { last_active: now, streak_days: newStreak },
    })

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
      res.json({ role: 'parent', user })
    } else if (req.user?.role === 'child') {
      const child = await prisma.child.findUnique({
        where: { id: req.user.id },
        select: { id: true, name: true, avatar_type: true, avatar_color: true, xp: true, level: true, coins: true, streak_days: true },
      })
      res.json({ role: 'child', child })
    } else {
      res.status(401).json({ error: 'Не авторизован' })
    }
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
}
