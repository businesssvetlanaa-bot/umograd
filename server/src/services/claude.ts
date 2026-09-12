import Anthropic from '@anthropic-ai/sdk'

const configuredModel = process.env.ANTHROPIC_MODEL || 'anthropic/claude-sonnet-4.6'
const MODEL = configuredModel.replace('claude-sonnet-4-6', 'claude-sonnet-4.6')

function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('Распознавание фотографий появится после подключения AI. Пока напишите задание текстом.')
  }
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    defaultHeaders: {
      'Authorization': `Bearer ${process.env.ANTHROPIC_API_KEY}`,
    },
  })
}

// ─── Распознавание домашнего задания по фото ──────────────────────────────────

export async function recognizeHomework(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
): Promise<{ subject: string; topic: string; task_text: string }> {
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          {
            type: 'text',
      text: `Ты помощник учителя начальной школы. На фото — домашнее задание ученика 4 класса российской школы.

Определи три вещи:
1. subject — предмет: "math" (математика), "russian" (русский язык), "english" (английский язык)
2. topic — тема задания: краткое название (например: "Таблица умножения на 7", "Безударные гласные в корне", "Present Simple")
3. task_text — точный текст задания, прочитанный с фото

Ответь СТРОГО в формате JSON, без пояснений и лишнего текста:
{"subject": "math", "topic": "Таблица умножения", "task_text": "Реши примеры: 3×4= 5×7= 8×6="}

Если не можешь прочитать задание или определить предмет:
{"error": "Не удалось распознать задание"}`,
          },
        ],
      },
    ],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
  const match = raw.match(/\{[\s\S]*?\}/)
  if (!match) throw new Error('Не удалось распознать задание')

  const parsed = JSON.parse(match[0]) as { subject?: string; topic?: string; task_text?: string; error?: string }
  if (parsed.error || !parsed.subject || !parsed.task_text) {
    throw new Error(parsed.error ?? 'Не удалось распознать задание')
  }

  return {
    subject:   parsed.subject,
    topic:     parsed.topic ?? '',
    task_text: parsed.task_text,
  }
}

// ─── Распознавание письменного ответа из тетради ─────────────────────────────

export async function recognizeAnswer(
  imageBase64: string,
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif',
): Promise<string> {
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
        {
          type: 'text',
          text: 'На фото — письменный ответ ребёнка 4 класса в тетради. Прочитай только текст ответа и верни его дословно, без пояснений. Если несколько строк — соедини через пробел. Если не можешь прочитать — верни: не разборчиво',
        },
      ],
    }],
  })

  return response.content[0].type === 'text' ? response.content[0].text.trim() : 'не разборчиво'
}

function localTutorReply(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): string {
  const directHelp = systemPrompt.includes('РЕЖИМ «БЫСТРАЯ ПОМОЩЬ»')
  const task = systemPrompt.match(/Цель занятия или задание ребёнка: ([\s\S]*?)\n\n━━━/)?.[1]?.trim()
    ?? 'эту тему'
  const lastMessage = history.at(-1)?.content.trim() ?? ''

  if (history.length <= 1) {
    return directHelp
      ? `Сейчас включена быстрая помощь. Разберём «${task}» по шагам: сначала определим правило, затем применим его и проверим ответ. Напиши, какое место вызывает больше всего вопросов — и я покажу полный разбор. 🧭`
      : `Давай спокойно разберёмся с темой «${task}» вместе. Сначала вспомним подходящее правило, а затем сделаем один маленький шаг. Что ты уже знаешь или успел попробовать? 🌟`
  }

  if (/готово|понял|поняла|получилось|спасибо/i.test(lastMessage)) {
    return 'Здорово! Ты прошёл это занятие до конца и сделал важный шаг. Продолжай в том же духе! 🏆\n\n{"session_complete": true, "xp_earned": 60, "coins_earned": 50}'
  }

  return directHelp
    ? 'Покажу способ: 1) выпиши известные данные, 2) выбери подходящее правило, 3) выполни действие, 4) проверь результат обратным действием. Пришли само выражение или предложение — разберём его полностью. ✨'
    : 'Хорошее начало! Найди в задании главное известное число или ключевое слово. Какое действие или правило оно тебе подсказывает? 💡'
}

// ─── Диалог с репетитором ─────────────────────────────────────────────────────

export async function chatWithTutor(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return localTutorReply(systemPrompt, history)
  }

  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: history,
  })

  return response.content[0].type === 'text' ? response.content[0].text : ''
}
