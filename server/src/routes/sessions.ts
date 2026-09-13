import { Router, Response } from 'express'
import { PrismaClient, Subject, MessageRole } from '@prisma/client'
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware'
import { recognizeHomework, recognizeAnswer, chatWithTutor } from '../services/claude'
import { findTopic } from '../services/topicMatcher'
import { buildTutorPrompt } from '../prompts/tutor'

const router = Router()
const prisma = new PrismaClient()

function canAccessChild(req: AuthRequest, childId: string, parentId: string): boolean {
  const user = req.user
  if (!user) return false
  return user.role === 'child' ? user.id === childId : user.id === parentId
}

// Извлекаем JSON session_complete из текста репетитора
function extractCompletion(text: string): {
  clean: string
  complete: boolean
  xp: number
  coins: number
} {
  const match = text.match(/\{"session_complete"\s*:\s*true[^}]*\}/)
  if (!match) return { clean: text, complete: false, xp: 0, coins: 0 }

  try {
    const json = JSON.parse(match[0]) as { session_complete: boolean; xp_earned?: number; coins_earned?: number }
    const clean = text.replace(match[0], '').trim()
    return {
      clean,
      complete: true,
      xp:    json.xp_earned    ?? 60,
      coins: json.coins_earned ?? 50,
    }
  } catch {
    return { clean: text, complete: false, xp: 0, coins: 0 }
  }
}

function getOpeningMessage(taskText: string, directAnswerAllowed = false): string {
  const normalized = taskText.trim().toLowerCase()
  if (normalized.startsWith('объясни мне тему')) return 'Я хочу разобраться в новой теме. Объясняй постепенно и проверяй, что я понял.'
  if (normalized.startsWith('проведи тренировку')) return 'Я хочу потренироваться. Давай по одному заданию и помогай подсказками.'
  return directAnswerAllowed
    ? 'Мне нужна быстрая помощь. Покажи решение по шагам, объясни правило и итоговый ответ.'
    : 'Помоги мне разобраться с заданием: объясняй спокойно, задавай вопросы и давай подсказки.'
}

// ─── POST /api/sessions/start ─────────────────────────────────────────────────
router.post('/start', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { child_id, image_base64, image_mime_type, task_text, task_hint, subject } = req.body as {
    child_id: string
    image_base64?: string
    image_mime_type?: string
    task_text?: string
    task_hint?: string
    subject?: string
  }

  if (!child_id) {
    res.status(400).json({ error: 'Укажите child_id' })
    return
  }

  try {
    const child = await prisma.child.findUnique({ where: { id: child_id } })
    if (!child) {
      res.status(404).json({ error: 'Профиль ребёнка не найден' })
      return
    }

    if (!canAccessChild(req, child.id, child.parent_id)) {
      res.status(403).json({ error: 'Нет доступа' })
      return
    }

    // 1. Распознаём задание
    let recognizedSubject = subject ?? 'math'
    let recognizedTopic   = ''
    let recognizedTask    = task_text ?? ''

    if (image_base64 && image_mime_type) {
      const mimeType = image_mime_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      const result = await recognizeHomework(image_base64, mimeType)
      recognizedSubject = subject ?? result.subject
      recognizedTopic   = result.topic
      recognizedTask    = result.task_text
      if (task_hint?.trim()) recognizedTask += `\nЗадание для разбора: ${task_hint.trim()}`
    }

    if (!recognizedTopic) {
      const manualTopic = recognizedTask.match(
        /^(?:Объясни мне тему|Проведи тренировку по теме)\s+«([^»]+)»/i,
      )
      recognizedTopic = manualTopic?.[1]?.trim() ?? ''
    }

    if (!recognizedTask) {
      res.status(400).json({ error: 'Укажите текст задания или загрузите фото' })
      return
    }

    // 2. Ищем тему в БД
    const topic = await findTopic(recognizedSubject, recognizedTask)

    // 3. Создаём сессию
    const session = await prisma.session.create({
      data: {
        child_id,
        subject:   recognizedSubject as Subject,
        topic_id:  topic?.id ?? null,
        task_text: recognizedTask,
      },
    })

    // 4. Строим системный промпт
    const systemPrompt = buildTutorPrompt({
      childName:   child.name,
      grade:       child.grade,
      subject:     recognizedSubject as 'math' | 'russian' | 'english',
      topicTitle:  topic?.title ?? recognizedTopic ?? recognizedSubject,
      topicRules:  topic?.rules ?? '',
      taskText:    recognizedTask,
      directAnswerAllowed: child.direct_answer_allowed,
    })

    // 5. Получаем первое сообщение репетитора
    const firstRaw = await chatWithTutor(systemPrompt, [
      { role: 'user', content: getOpeningMessage(recognizedTask, child.direct_answer_allowed) },
    ])

    const { clean: firstMessage } = extractCompletion(firstRaw)

    // 6. Сохраняем первое сообщение
    await prisma.message.create({
      data: {
        session_id: session.id,
        role:       MessageRole.assistant,
        content:    firstMessage,
      },
    })

    res.status(201).json({
      session_id:    session.id,
      first_message: firstMessage,
      subject:       recognizedSubject,
      topic:         topic?.title ?? recognizedTopic,
      task_text:     recognizedTask,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Ошибка сервера'
    console.error('Session start failed:', msg)
    res.status(500).json({ error: msg })
  }
})

// ─── GET /api/sessions/:id ────────────────────────────────────────────────────
router.get('/:id', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = req.params['id'] as string

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { created_at: 'asc' } },
        topic:    true,
        child:    { select: { name: true, parent_id: true } },
      },
    })

    if (!session) {
      res.status(404).json({ error: 'Сессия не найдена' })
      return
    }

    if (!canAccessChild(req, session.child_id, session.child.parent_id)) {
      res.status(403).json({ error: 'Нет доступа' })
      return
    }

    res.json({ ...session, child: { name: session.child.name } })
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' })
  }
})

// Сохраняем только техническую статистику голосовых функций. Само аудио не храним.
router.post('/:id/voice-usage', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = req.params['id'] as string
  const { kind, duration_ms = 0, characters = 0 } = req.body as {
    kind?: string
    duration_ms?: number
    characters?: number
  }
  const allowedKinds = new Set(['speech_input', 'speech_output', 'speech_output_english'])

  if (!kind || !allowedKinds.has(kind)) {
    res.status(400).json({ error: 'Неизвестный тип голосового события' })
    return
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { child_id: true, child: { select: { parent_id: true } } },
    })

    if (!session) {
      res.status(404).json({ error: 'Сессия не найдена' })
      return
    }

    if (!canAccessChild(req, session.child_id, session.child.parent_id)) {
      res.status(403).json({ error: 'Нет доступа' })
      return
    }

    await prisma.voiceUsageEvent.create({
      data: {
        session_id: sessionId,
        kind,
        duration_ms: Math.max(0, Math.min(Number(duration_ms) || 0, 60 * 60 * 1000)),
        characters: Math.max(0, Math.min(Number(characters) || 0, 10000)),
      },
    })
    res.status(201).json({ ok: true })
  } catch {
    res.status(404).json({ error: 'Сессия не найдена' })
  }
})

// ─── POST /api/sessions/:id/message ──────────────────────────────────────────
router.post('/:id/message', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const sessionId = req.params['id'] as string
  const { content, image_base64, image_mime_type } = req.body as {
    content?: string
    image_base64?: string
    image_mime_type?: string
  }

  if (!content?.trim() && !image_base64) {
    res.status(400).json({ error: 'Введите сообщение или отправьте фото' })
    return
  }

  try {
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { created_at: 'asc' } },
        child:    true,
        topic:    true,
      },
    })

    if (!session) {
      res.status(404).json({ error: 'Сессия не найдена' })
      return
    }

    if (!canAccessChild(req, session.child_id, session.child.parent_id)) {
      res.status(403).json({ error: 'Нет доступа' })
      return
    }

    if (session.completed) {
      res.status(400).json({ error: 'Сессия уже завершена' })
      return
    }

    // Распознаём фото ответа (если прислано)
    let savedUserContent = content?.trim() ?? ''
    let contentForTutor  = content?.trim() ?? ''

    if (image_base64 && image_mime_type) {
      const mimeType = image_mime_type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
      try {
        const recognized = await recognizeAnswer(image_base64, mimeType)
        savedUserContent = `📷 Ответ из тетради: ${recognized}`
        contentForTutor  = `Я написал в тетради: ${recognized}${content?.trim() ? '. ' + content.trim() : ''}`
      } catch {
        savedUserContent = content?.trim() || '📷 Фото ответа'
        contentForTutor  = content?.trim() || 'Посмотри на моё решение.'
      }
    }

    // Сохраняем сообщение ребёнка
    await prisma.message.create({
      data: { session_id: sessionId, role: MessageRole.user, content: savedUserContent },
    })

    // Строим системный промпт
    const systemPrompt = buildTutorPrompt({
      childName:  session.child.name,
      grade:      session.child.grade,
      subject:    session.subject as 'math' | 'russian' | 'english',
      topicTitle: session.topic?.title ?? String(session.subject),
      topicRules: session.topic?.rules ?? '',
      taskText:   session.task_text ?? '',
      directAnswerAllowed: session.child.direct_answer_allowed,
    })

    // Собираем историю диалога
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: getOpeningMessage(session.task_text ?? '', session.child.direct_answer_allowed) },
      ...session.messages.map((m) => ({
        role:    m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: contentForTutor },
    ]

    // Получаем ответ репетитора
    const raw = await chatWithTutor(systemPrompt, history)
    const { clean: replyText, complete, xp, coins } = extractCompletion(raw)

    // Сохраняем ответ репетитора
    await prisma.message.create({
      data: { session_id: sessionId, role: MessageRole.assistant, content: replyText },
    })

    if (complete) {
      // Завершаем сессию
      await prisma.session.update({
        where: { id: sessionId },
        data: { completed: true, ended_at: new Date(), xp_earned: xp, coins_earned: coins },
      })

      // Начисляем XP и монеты ребёнку
      const child = await prisma.child.update({
        where: { id: session.child_id },
        data: {
          xp:    { increment: xp },
          coins: { increment: coins },
        },
      })

      // Пересчитываем уровень (каждые 100 XP = новый уровень)
      const newLevel = Math.floor(child.xp / 100) + 1
      if (newLevel > child.level) {
        await prisma.child.update({ where: { id: child.id }, data: { level: newLevel } })
      }

      // Обновляем прогресс по предмету
      const existing = await prisma.subjectProgress.findUnique({
        where: { child_id_subject: { child_id: session.child_id, subject: session.subject } },
      })

      let spId: string
      if (existing) {
        const updated = await prisma.subjectProgress.update({
          where: { id: existing.id },
          data: {
            sessions_count: { increment: 1 },
            mastery_level:  Math.min(100, existing.mastery_level + 5),
          },
        })
        spId = updated.id
      } else {
        const created = await prisma.subjectProgress.create({
          data: {
            child_id:       session.child_id,
            subject:        session.subject,
            mastery_level:  5,
            sessions_count: 1,
          },
        })
        spId = created.id
      }

      // Обновляем прогресс по теме (если сессия привязана к теме)
      if (session.topic_id) {
        const existingTp = await prisma.topicProgress.findUnique({
          where: { subject_progress_id_topic_id: { subject_progress_id: spId, topic_id: session.topic_id } },
        })
        if (existingTp) {
          await prisma.topicProgress.update({
            where: { id: existingTp.id },
            data: {
              mastery_level:  Math.min(100, existingTp.mastery_level + 10),
              sessions_count: { increment: 1 },
            },
          })
        } else {
          await prisma.topicProgress.create({
            data: { subject_progress_id: spId, topic_id: session.topic_id, mastery_level: 10, sessions_count: 1 },
          })
        }
      }

      res.json({ message: replyText, session_complete: true, xp_earned: xp, coins_earned: coins, user_content: savedUserContent })
    } else {
      res.json({ message: replyText, session_complete: false, user_content: savedUserContent })
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Ошибка сервера'
    res.status(500).json({ error: msg })
  }
})

export default router
