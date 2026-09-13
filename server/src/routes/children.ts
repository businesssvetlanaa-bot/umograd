import { Router, Request, Response } from 'express'
import { PrismaClient, BuildingType } from '@prisma/client'
import { authMiddleware, requireParent, AuthRequest } from '../middleware/authMiddleware'
import { STARTER_BUILDINGS, BUILDINGS_CATALOG, getBuildingByType, BuildingDefinition } from '../data/buildings_catalog'

const router = Router()
const prisma = new PrismaClient()

// ─────────────────────────────────────────
// ПУБЛИЧНЫЙ — для детского входа
// ─────────────────────────────────────────

// GET /api/children/by-parent-email?email=...
router.get('/by-parent-email', async (req: Request, res: Response): Promise<void> => {
  const raw = req.query['email']
  const email = typeof raw === 'string' ? raw : undefined
  if (!email) {
    res.status(400).json({ error: 'Укажите email' })
    return
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        children: {
          select: {
            id: true, name: true, grade: true, avatar_type: true, avatar_color: true,
            xp: true, level: true, coins: true, streak_days: true,
          },
        },
      },
    })
    if (!user) {
      res.status(404).json({ error: 'Родитель не найден' })
      return
    }
    res.json(user.children)
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// ─────────────────────────────────────────
// АВТОРИЗОВАННЫЕ
// ─────────────────────────────────────────

// GET /api/children — список детей родителя
router.get('/', authMiddleware, requireParent, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const children = await prisma.child.findMany({
      where: { parent_id: req.user!.id },
      select: {
        id: true, name: true, grade: true, avatar_type: true, avatar_color: true,
        xp: true, level: true, coins: true, streak_days: true, last_active: true,
      },
      orderBy: { created_at: 'asc' },
    })
    res.json(children)
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// POST /api/children — создать ребёнка
router.post('/', authMiddleware, requireParent, async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, grade, avatar_type, avatar_color, pin } = req.body as {
    name?: string
    grade?: number
    avatar_type?: string
    avatar_color?: string
    direct_answer_allowed?: boolean
    pin?: string
  }

  if (!name || !name.trim()) {
    res.status(400).json({ error: 'Введите имя ребёнка' })
    return
  }
  if (!avatar_type || !avatar_color) {
    res.status(400).json({ error: 'Выберите персонажа и цвет' })
    return
  }
  if (grade !== 3 && grade !== 4) {
    res.status(400).json({ error: 'Сейчас доступны 3 и 4 классы' })
    return
  }

  const VALID_AVATARS = ['explorer', 'witch', 'builder', 'ranger']
  const VALID_COLORS  = ['blue', 'green', 'orange', 'purple']
  if (!VALID_AVATARS.includes(avatar_type) || !VALID_COLORS.includes(avatar_color)) {
    res.status(400).json({ error: 'Неверный тип персонажа или цвет' })
    return
  }

  try {
    const child = await prisma.child.create({
      data: {
        parent_id:    req.user!.id,
        name:         name.trim(),
        grade,
        avatar_type,
        avatar_color,
        pin:          pin ?? null,
        xp:           0,
        level:        1,
        streak_days:  0,
        coins:        50,
      },
    })

    // Стартовая постройка — домик
    for (const b of STARTER_BUILDINGS) {
      await prisma.building.create({
        data: {
          child_id:      child.id,
          building_type: b.type as BuildingType,
          placed:        true,
          position_x:    400,
          position_y:    250,
        },
      })
    }

    res.status(201).json(child)
  } catch {
    res.status(500).json({ error: 'Ошибка сервера. Попробуйте позже' })
  }
})

// GET /api/children/:id/dashboard
router.get('/:id/dashboard', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const childId = req.params['id'] as string

  if (req.user!.role === 'child' && req.user!.id !== childId) {
    res.status(403).json({ error: 'Нет доступа' })
    return
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: childId },
      include: {
        subject_progress: true,
        buildings: true,
      },
    })

    if (!child) {
      res.status(404).json({ error: 'Профиль не найден' })
      return
    }

    if (req.user!.role === 'parent' && child.parent_id !== req.user!.id) {
      res.status(403).json({ error: 'Нет доступа' })
      return
    }

    res.json({
      id:               child.id,
      name:             child.name,
      grade:            child.grade,
      avatar_type:      child.avatar_type,
      avatar_color:     child.avatar_color,
      xp:               child.xp,
      level:            child.level,
      coins:            child.coins,
      streak_days:      child.streak_days,
      last_active:      child.last_active,
      direct_answer_allowed: child.direct_answer_allowed,
      subject_progress: child.subject_progress,
      buildings:        child.buildings,
    })
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// ─── helpers ─────────────────────────────────────────────────────────────────

function checkUnlocked(
  def: BuildingDefinition,
  child: { level: number; subject_progress: Array<{ subject: string; mastery_level: number }> },
  sessionsCount: number,
): boolean {
  if (def.is_starter) return true
  if (child.level < def.required_level) return false
  if (sessionsCount < def.required_sessions) return false
  if (def.required_subject && def.required_mastery !== undefined) {
    const prog = child.subject_progress.find((p) => p.subject === def.required_subject)
    if (!prog || prog.mastery_level < def.required_mastery) return false
  }
  return true
}

// ─── GET /api/children/:id/buildings ─────────────────────────────────────────
router.get('/:id/buildings', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const childId = req.params['id'] as string

  if (req.user!.role === 'child' && req.user!.id !== childId) {
    res.status(403).json({ error: 'Нет доступа' })
    return
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: childId },
      include: { buildings: true, subject_progress: true },
    })

    if (!child) { res.status(404).json({ error: 'Профиль не найден' }); return }

    if (req.user!.role === 'parent' && child.parent_id !== req.user!.id) {
      res.status(403).json({ error: 'Нет доступа' })
      return
    }

    const sessionsCount = await prisma.session.count({
      where: { child_id: childId, completed: true },
    })

    const result = BUILDINGS_CATALOG.map((def) => {
      const owned = child.buildings.find((b) => b.building_type === def.type)
      const unlocked = checkUnlocked(def, child, sessionsCount)
      return {
        building_type:     def.type,
        name:              def.name,
        emoji:             def.emoji,
        description:       def.description,
        cost:              def.cost,
        required_level:    def.required_level,
        required_sessions: def.required_sessions,
        unlock_hint:       def.unlock_hint,
        unlocked,
        owned:      !!owned,
        placed:     owned?.placed      ?? false,
        position_x: owned?.position_x  ?? null,
        position_y: owned?.position_y  ?? null,
        id:         owned?.id          ?? null,
      }
    })

    res.json(result)
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// ─── POST /api/children/:id/buildings ────────────────────────────────────────
router.post('/:id/buildings', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const childId = req.params['id'] as string
  const { building_type, position_x, position_y } = req.body as {
    building_type: string
    position_x: number
    position_y: number
  }

  if (req.user!.role === 'child' && req.user!.id !== childId) {
    res.status(403).json({ error: 'Нет доступа' })
    return
  }

  const def = getBuildingByType(building_type as BuildingType)
  if (!def) { res.status(400).json({ error: 'Неизвестная постройка' }); return }

  try {
    const child = await prisma.child.findUnique({
      where: { id: childId },
      include: { buildings: true, subject_progress: true },
    })
    if (!child) { res.status(404).json({ error: 'Профиль не найден' }); return }

    if (req.user!.role === 'parent' && child.parent_id !== req.user!.id) {
      res.status(403).json({ error: 'Нет доступа' })
      return
    }

    const existing = child.buildings.find((b) => b.building_type === building_type)

    if (existing) {
      // Постройка уже куплена — просто перемещаем
      const updated = await prisma.building.update({
        where: { id: existing.id },
        data: { placed: true, position_x, position_y },
      })
      res.json(updated)
      return
    }

    // Проверяем монеты и разблокировку
    if (child.coins < def.cost) {
      res.status(400).json({ error: 'Недостаточно монет' })
      return
    }

    const sessionsCount = await prisma.session.count({
      where: { child_id: childId, completed: true },
    })
    if (!checkUnlocked(def, child, sessionsCount)) {
      res.status(400).json({ error: 'Постройка ещё не разблокирована' })
      return
    }

    // Списываем монеты и создаём постройку
    await prisma.child.update({ where: { id: childId }, data: { coins: { decrement: def.cost } } })
    const building = await prisma.building.create({
      data: { child_id: childId, building_type: building_type as BuildingType, placed: true, position_x, position_y },
    })

    res.status(201).json(building)
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// PUT /api/children/:id — обновить имя или аватар
router.put('/:id', authMiddleware, requireParent, async (req: AuthRequest, res: Response): Promise<void> => {
  const childId = req.params['id'] as string
  const { name, grade, avatar_type, avatar_color, direct_answer_allowed } = req.body as {
    name?: string
    grade?: number
    avatar_type?: string
    avatar_color?: string
    direct_answer_allowed?: boolean
  }

  try {
    const child = await prisma.child.findUnique({ where: { id: childId } })
    if (!child || child.parent_id !== req.user!.id) {
      res.status(404).json({ error: 'Профиль не найден' })
      return
    }

    const updated = await prisma.child.update({
      where: { id: childId },
      data: {
        ...(name        ? { name: name.trim() } : {}),
        ...(grade === 3 || grade === 4 ? { grade } : {}),
        ...(avatar_type  ? { avatar_type }       : {}),
        ...(avatar_color ? { avatar_color }       : {}),
        ...(typeof direct_answer_allowed === 'boolean' ? { direct_answer_allowed } : {}),
      },
    })
    res.json(updated)
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

export default router
