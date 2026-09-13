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
  const subject = systemPrompt.match(/Предмет: (.+)/)?.[1]?.trim() ?? 'Учебный предмет'
  const topic = systemPrompt.match(/Тема: (.+)/)?.[1]?.trim() ?? 'эта тема'
  const task = systemPrompt.match(/Цель занятия или задание ребёнка: ([\s\S]*?)\n\n━━━/)?.[1]?.trim()
    ?? 'эту тему'
  const lastMessage = history.at(-1)?.content.trim() ?? ''
  const normalized = lastMessage.toLowerCase()
  const userTurn = history.filter((message) => message.role === 'user').length
  const isFractions = /дроб|числител|знаменател/i.test(`${topic} ${task}`)

  if (history.length <= 1) {
    if (isFractions) {
      return 'Дробь показывает часть целого: число снизу говорит, на сколько равных частей разделили целое, а число сверху — сколько частей взяли. Например, 1/2 — это одна из двух равных частей. Какое число в дроби 3/4 показывает количество всех равных частей? 🍕'
    }
    return directHelp
      ? `Сейчас включена быстрая помощь. Разберём «${task}» по шагам: сначала определим правило по теме «${topic}», затем применим его и проверим ответ. Напиши, какое место вызывает больше всего вопросов — и я покажу полный разбор. 🧭`
      : `Сегодня разбираем тему «${topic}» (${subject}). Начнём с простого примера по твоей задаче: «${task}». Что ты уже знаешь или успел попробовать? 🌟`
  }

  if (/готово|понял|поняла|получилось|спасибо/i.test(lastMessage)) {
    return 'Здорово! Ты прошёл это занятие до конца и сделал важный шаг. Продолжай в том же духе! 🏆\n\n{"session_complete": true, "xp_earned": 60, "coins_earned": 50}'
  }

  if (isFractions) {
    if (/знаменател/.test(normalized)) {
      return 'Верно: знаменатель показывает, на сколько равных частей разделили целое ⭐ А числитель показывает, сколько таких частей взяли. В дроби 3/4 какое число будет числителем?'
    }
    if (/числител/.test(normalized)) {
      return 'Отлично, числитель — это количество взятых частей! Например, 3/5 означает, что взяли 3 части из 5 равных. Что тогда означает дробь 2/7?'
    }
    if (/одн|1\s*\/\s*2|половин/.test(normalized)) {
      return 'Точно: 1/2 — одна из двух равных частей 🌟 Теперь представь пиццу, разделённую на 4 части: какую дробь составят 3 кусочка?'
    }
    return `Спасибо, я учёл твой ответ: «${lastMessage.slice(0, 80)}». Подсказка: сначала посмотри на нижнее число — оно показывает все равные части. Что означает знаменатель в дроби?`
  }

  if (directHelp) {
    return `Учёл твой ответ: «${lastMessage.slice(0, 80)}». Полный способ такой: 1) выдели условие, 2) примени правило темы «${topic}», 3) проверь результат. Какой из этих шагов показать на твоём примере? ✨`
  }

  const prompts = [
    `Хорошее начало! В твоём ответе важно: «${lastMessage.slice(0, 70)}». Какое правило темы «${topic}» подходит к этому шагу? 💡`,
    `Я вижу ход мысли. Проверим его на маленьком похожем примере по теме «${topic}»: сначала назови известные данные, затем нужное действие. Что известно? 🧭`,
    `Продолжаем с учётом твоего ответа. Сделай следующий маленький шаг и объясни, почему выбрал именно его — так мы проверим понимание. ⭐`,
  ]
  return prompts[(userTurn - 2) % prompts.length]
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
