import { Router, Request, Response } from 'express'
import { BuildingType } from '@prisma/client'
import { authMiddleware, requireParent, AuthRequest } from '../middleware/authMiddleware'
import { prisma } from '../lib/prisma'
import { STARTER_BUILDINGS, BUILDINGS_CATALOG, getBuildingByType, BuildingDefinition } from '../data/buildings_catalog'
import { childLoginThrottle, hashChildPin, isValidChildPin, normalizeParentEmail, parentOwnsChild, publicChildResponse, safeChildResponse } from '../services/childAccess'
import { confirmsChildDeletion } from '../services/accountSecurity'

const router = Router()

type ChildOwner = { id: string; parent_id: string }
type CurriculumTopicJson = {
  id?: unknown
  topic_key?: unknown
  title?: unknown
  description?: unknown
  order?: unknown
  enabled?: unknown
}

function canAccessChild(req: AuthRequest, child: ChildOwner): boolean {
  const user = req.user
  if (!user) return false
  return user.role === 'child' ? user.id === child.id : user.id === child.parent_id
}

function parseCurriculumTopics(value: unknown): Array<{
  topic_key: string
  title: string
  description: string
  order: number
  enabled: boolean
}> {
  if (!Array.isArray(value)) return []

  return value.flatMap((item, index) => {
    if (!item || typeof item !== 'object') return []
    const topic = item as CurriculumTopicJson
    const topicKey = typeof topic.topic_key === 'string'
      ? topic.topic_key
      : typeof topic.id === 'string' ? topic.id : ''
    const title = typeof topic.title === 'string' ? topic.title.trim() : ''
    if (!topicKey || !title) return []

    return [{
      topic_key: topicKey,
      title,
      description: typeof topic.description === 'string' ? topic.description : '',
      order: typeof topic.order === 'number' ? topic.order : index + 1,
      enabled: topic.enabled !== false,
    }]
  })
}

// ─────────────────────────────────────────
// ПУБЛИЧНЫЙ — для детского входа
// ─────────────────────────────────────────

// GET /api/children/by-parent-email?email=...
router.get('/by-parent-email', async (req: Request, res: Response): Promise<void> => {
  const raw = req.query['email']
  const email = normalizeParentEmail(raw)
  if (!email) {
    res.status(400).json({ error: 'Введите корректный email родителя' })
    return
  }
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { children: { select: { id: true, name: true, grade: true, pin: true } } },
    })
    res.json(user?.children.map(publicChildResponse) ?? [])
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
  if (pin !== undefined && !isValidChildPin(pin)) {
    res.status(400).json({ error: 'PIN-код должен состоять ровно из 4 цифр' })
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
    const hashedPin = pin ? await hashChildPin(pin) : null
    const child = await prisma.child.create({
      data: {
        parent_id:    req.user!.id,
        name:         name.trim(),
        grade,
        avatar_type,
        avatar_color,
        pin:          hashedPin,
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

    res.status(201).json(safeChildResponse(child))
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
      has_pin:          Boolean(child.pin),
      direct_answer_allowed: child.direct_answer_allowed,
      subject_progress: child.subject_progress,
      buildings:        child.buildings,
    })
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// GET /api/children/:id/curricula — программы с персональными настройками тем
router.get('/:id/curricula', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const childId = req.params['id'] as string

  try {
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, parent_id: true, grade: true },
    })
    if (!child) { res.status(404).json({ error: 'Профиль не найден' }); return }
    if (!canAccessChild(req, child)) { res.status(403).json({ error: 'Нет доступа' }); return }

    const curricula = await prisma.curriculum.findMany({
      where: {
        grade: child.grade,
        OR: [{ is_system: true }, { parent_id: child.parent_id }],
      },
      include: {
        topic_settings: {
          where: { child_id: childId },
          select: { topic_key: true, enabled: true },
        },
      },
      orderBy: [{ is_system: 'desc' }, { created_at: 'desc' }],
    })

    res.json(curricula.map((curriculum) => {
      const settings = new Map(curriculum.topic_settings.map((setting) => [setting.topic_key, setting.enabled]))
      return {
        id: curriculum.id,
        name: curriculum.name,
        grade: curriculum.grade,
        subject: curriculum.subject,
        is_system: curriculum.is_system,
        created_at: curriculum.created_at,
        topics: parseCurriculumTopics(curriculum.topics).map((topic) => ({
          ...topic,
          enabled: settings.get(topic.topic_key) ?? topic.enabled,
        })),
      }
    }))
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// GET /api/children/:id/topics?subject=math|russian|english
router.get('/:id/topics', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const childId = req.params['id'] as string
  const subject = req.query['subject']
  if (subject !== 'math' && subject !== 'russian' && subject !== 'english') {
    res.status(400).json({ error: 'Неизвестный предмет' })
    return
  }

  try {
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { id: true, parent_id: true, grade: true },
    })
    if (!child) { res.status(404).json({ error: 'Профиль не найден' }); return }
    if (!canAccessChild(req, child)) { res.status(403).json({ error: 'Нет доступа' }); return }

    const curricula = await prisma.curriculum.findMany({
      where: {
        grade: child.grade,
        subject,
        OR: [{ is_system: true }, { parent_id: child.parent_id }],
      },
      include: {
        topic_settings: {
          where: { child_id: childId },
          select: { topic_key: true, enabled: true },
        },
      },
      orderBy: [{ is_system: 'desc' }, { created_at: 'desc' }],
    })

    const seenTitles = new Set<string>()
    const topics = curricula.flatMap((curriculum) => {
      const settings = new Map(curriculum.topic_settings.map((setting) => [setting.topic_key, setting.enabled]))
      return parseCurriculumTopics(curriculum.topics)
        .filter((topic) => settings.get(topic.topic_key) ?? topic.enabled)
        .sort((a, b) => a.order - b.order)
        .flatMap((topic) => {
          const normalizedTitle = topic.title.normalize('NFKC').trim().toLocaleLowerCase('ru-RU')
          if (seenTitles.has(normalizedTitle)) return []
          seenTitles.add(normalizedTitle)
          return [{
            curriculum_id: curriculum.id,
            topic_key: topic.topic_key,
            title: topic.title,
            description: topic.description,
            order: topic.order,
          }]
        })
    })

    res.json(topics)
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// PUT /api/children/:id/curricula/:curriculumId/topics/:topicKey
router.put(
  '/:id/curricula/:curriculumId/topics/:topicKey',
  authMiddleware, requireParent,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const childId = req.params['id'] as string
    const curriculumId = req.params['curriculumId'] as string
    const topicKey = req.params['topicKey'] as string
    const { enabled } = req.body as { enabled?: unknown }

    if (typeof enabled !== 'boolean') {
      res.status(400).json({ error: 'Укажите enabled' })
      return
    }

    try {
      const child = await prisma.child.findUnique({
        where: { id: childId },
        select: { id: true, parent_id: true, grade: true },
      })
      if (!child) { res.status(404).json({ error: 'Профиль не найден' }); return }
      if (child.parent_id !== req.user!.id) { res.status(403).json({ error: 'Нет доступа' }); return }

      const curriculum = await prisma.curriculum.findFirst({
        where: {
          id: curriculumId,
          grade: child.grade,
          OR: [{ is_system: true }, { parent_id: req.user!.id }],
        },
      })
      if (!curriculum) { res.status(404).json({ error: 'Программа не найдена' }); return }

      const topicExists = parseCurriculumTopics(curriculum.topics)
        .some((topic) => topic.topic_key === topicKey)
      if (!topicExists) { res.status(404).json({ error: 'Тема не найдена' }); return }

      await prisma.childTopicSetting.upsert({
        where: {
          child_id_curriculum_id_topic_key: {
            child_id: childId,
            curriculum_id: curriculumId,
            topic_key: topicKey,
          },
        },
        create: { child_id: childId, curriculum_id: curriculumId, topic_key: topicKey, enabled },
        update: { enabled },
      })

      res.json({ ok: true })
    } catch {
      res.status(500).json({ error: 'Ошибка сервера' })
    }
  },
)

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

// PUT /api/children/:id/pin — установить или сменить PIN ребёнка
router.put('/:id/pin', authMiddleware, requireParent, async (req: AuthRequest, res: Response): Promise<void> => {
  const childId = req.params['id'] as string
  const { pin } = req.body as { pin?: unknown }
  if (!isValidChildPin(pin)) { res.status(400).json({ error: 'PIN-код должен состоять ровно из 4 цифр' }); return }
  try {
    const child = await prisma.child.findUnique({ where: { id: childId }, select: { parent_id: true } })
    if (!child) { res.status(404).json({ error: 'Профиль не найден' }); return }
    if (!parentOwnsChild(req.user!.id, child.parent_id)) { res.status(403).json({ error: 'Нет доступа' }); return }
    await prisma.child.update({ where: { id: childId }, data: { pin: await hashChildPin(pin) } })
    childLoginThrottle.clearChild(childId)
    res.json({ success: true, has_pin: true })
  } catch { res.status(500).json({ error: 'Ошибка сервера' }) }
})

// DELETE /api/children/:id/pin — запретить самостоятельный вход ребёнка
router.delete('/:id/pin', authMiddleware, requireParent, async (req: AuthRequest, res: Response): Promise<void> => {
  const childId = req.params['id'] as string
  try {
    const child = await prisma.child.findUnique({ where: { id: childId }, select: { parent_id: true } })
    if (!child) { res.status(404).json({ error: 'Профиль не найден' }); return }
    if (!parentOwnsChild(req.user!.id, child.parent_id)) { res.status(403).json({ error: 'Нет доступа' }); return }
    await prisma.child.update({ where: { id: childId }, data: { pin: null } })
    childLoginThrottle.clearChild(childId)
    res.json({ success: true, has_pin: false })
  } catch { res.status(500).json({ error: 'Ошибка сервера' }) }
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
    res.json(safeChildResponse(updated))
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// DELETE /api/children/:id — удалить принадлежащий родителю профиль и связанные данные
router.delete('/:id', authMiddleware, requireParent, async (req: AuthRequest, res: Response): Promise<void> => {
  const childId = req.params['id'] as string
  const { confirmation } = req.body as { confirmation?: unknown }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const child = await tx.child.findFirst({
        where: { id: childId, parent_id: req.user!.id },
        select: { id: true, name: true },
      })
      if (!child) return { status: 'not_found' as const }
      if (!confirmsChildDeletion(confirmation, child.name)) return { status: 'invalid_confirmation' as const }
      const deleted = await tx.child.deleteMany({ where: { id: child.id, parent_id: req.user!.id } })
      return { status: deleted.count === 1 ? 'deleted' as const : 'not_found' as const }
    })

    if (result.status === 'not_found') {
      res.status(404).json({ error: '\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d' })
      return
    }
    if (result.status === 'invalid_confirmation') {
      res.status(400).json({ error: '\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0444\u0440\u0430\u0437\u0443 \u0443\u0434\u0430\u043b\u0435\u043d\u0438\u044f \u0442\u043e\u0447\u043d\u043e \u043a\u0430\u043a \u043f\u043e\u043a\u0430\u0437\u0430\u043d\u043e' })
      return
    }

    childLoginThrottle.clearChild(childId)
    res.json({ success: true })
  } catch {
    res.status(500).json({ error: '\u041e\u0448\u0438\u0431\u043a\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0430' })
  }
})
export default router
