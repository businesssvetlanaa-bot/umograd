export type TutorMessage = { role: 'user' | 'assistant'; content: string }

type TutorContext = {
  subject: string
  topic: string
  rule: string
  task: string
  directHelp: boolean
}

const MAX_RULE_LENGTH = 650
const MAX_TASK_LENGTH = 180

function normalizeText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/gu, ' ').trim()
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`
}

function extractContext(systemPrompt: string): TutorContext {
  const subject = systemPrompt.match(/^Предмет:\s*(.+)$/mu)?.[1]?.trim() ?? 'Учебный предмет'
  const topic = systemPrompt.match(/^Тема:\s*(.+)$/mu)?.[1]?.trim() ?? 'эта тема'
  const rule = systemPrompt.match(/Правило по теме:\s*([\s\S]*?)\nЦель занятия или задание ребёнка:/u)?.[1] ?? ''
  const task = systemPrompt.match(/Цель занятия или задание ребёнка:\s*([\s\S]*?)\n\n━━━ ТВОЙ ХАРАКТЕР/u)?.[1] ?? ''

  return {
    subject: normalizeText(subject, 80),
    topic: normalizeText(topic, 120),
    rule: normalizeText(rule, MAX_RULE_LENGTH),
    task: normalizeText(task, MAX_TASK_LENGTH),
    directHelp: systemPrompt.includes('РЕЖИМ «БЫСТРАЯ ПОМОЩЬ»'),
  }
}

function ruleParts(rule: string): string[] {
  return rule
    .split(/(?<=[.!?])\s+/u)
    .map((part) => part.trim())
    .filter(Boolean)
}

function ruleExcerpt(rule: string, count = 2): string {
  const parts = ruleParts(rule)
  return normalizeText(parts.slice(0, count).join(' '), 430)
}

function focusedRulePart(rule: string, turn: number): string {
  const parts = ruleParts(rule)
  if (parts.length === 0) return ''
  return normalizeText(parts[turn % parts.length] ?? parts[0], 260)
}

function subjectKind(subject: string): 'math' | 'russian' | 'english' | 'other' {
  if (/математ/i.test(subject)) return 'math'
  if (/русск/i.test(subject)) return 'russian'
  if (/английск|english/i.test(subject)) return 'english'
  return 'other'
}

function subjectQuestion(subject: string, task: string): string {
  const taskHint = task ? ` в задании «${task}»` : ''
  switch (subjectKind(subject)) {
    case 'math':
      return `Какое действие или следующий шаг нужно сделать${taskHint}?`
    case 'russian':
      return `Какой признак нужно сначала найти${taskHint} и как его проверить?`
    case 'english':
      return 'Какое английское слово или форму из правила ты попробуешь произнести?'
    default:
      return `Какой первый шаг подсказывает правило${taskHint}?`
  }
}

function englishRuleExample(rule: string): string {
  const example = ruleParts(rule).find((part) => /[A-Za-z]{2,}/u.test(part))
  return example ? normalizeText(example, 250) : ruleExcerpt(rule, 1)
}

function firstReply(context: TutorContext): string {
  if (!context.rule) {
    return `Начинаем тему «${context.topic}» (${context.subject}). В программе для неё нет подробного правила, поэтому я не буду придумывать объяснение. Напиши правило из учебника или небольшой пример — что у тебя есть?`
  }

  const explanation = ruleExcerpt(context.rule)
  if (context.directHelp) {
    return `Тема «${context.topic}»: правило говорит — ${explanation} Действуй по шагам: 1) найди в задании данные для этого правила; 2) примени правило по порядку; 3) проверь результат по условию. Какой первый шаг получается для задания «${context.task || context.topic}»?`
  }

  if (subjectKind(context.subject) === 'english') {
    const englishExample = englishRuleExample(context.rule)
    return `Разбираем тему «${context.topic}». В правиле есть такой английский пример: ${englishExample} ${subjectQuestion(context.subject, context.task)} Нажми кнопку 🔊 English, чтобы прослушать английский пример.`
  }

  return `Разбираем тему «${context.topic}». Главное правило: ${explanation} ${subjectQuestion(context.subject, context.task)}`
}

function smallerStepReply(context: TutorContext): string {
  if (!context.rule) {
    return `Ничего страшного — для темы «${context.topic}» у меня нет подробного правила, и я не хочу его придумывать. Пришли одну строку правила или один пример из учебника — с чего начнём?`
  }

  const neededPart = focusedRulePart(context.rule, 0)
  switch (subjectKind(context.subject)) {
    case 'math':
      return `Давай только один маленький шаг: ${neededPart} Посмотри на задание и назови лишь первое действие — что нужно сделать?`
    case 'russian':
      return `Возьмём только один признак: ${neededPart} Найди в задании одно слово, на котором можно проверить этот признак — какое?`
    case 'english':
      return `Возьмём один английский пример из правила: ${englishRuleExample(context.rule)} Нажми 🔊 English, послушай его и выбери одно слово для повторения — какое?`
    default:
      return `Разберём один маленький кусочек правила: ${neededPart} Что из этого можно применить первым?`
  }
}

function followUpReply(context: TutorContext, lastMessage: string, userTurn: number): string {
  if (!context.rule) {
    return `Я услышал ответ «${normalizeText(lastMessage, 80)}», но подробного правила по теме «${context.topic}» в программе нет. Чтобы не придумывать объяснение, пришли правило или пример из учебника — что можешь добавить?`
  }

  const neededPart = focusedRulePart(context.rule, userTurn - 2)
  const answer = normalizeText(lastMessage, 80)
  const nextQuestion = subjectQuestion(context.subject, context.task)
  const templates = [
    `Ты написал: «${answer}». Сверим с правилом: ${neededPart} ${nextQuestion}`,
    `Возьмём из правила нужную часть: ${neededPart} Теперь сопоставь её со своим ответом «${answer}». Что из правила определяет следующий шаг?`,
    `Зафиксирую твою мысль: «${answer}». Для проверки нам нужна часть правила: ${neededPart} Как применишь её к этому заданию?`,
  ]
  return templates[(userTurn - 2) % templates.length]
}

export function localTutorReply(systemPrompt: string, history: TutorMessage[]): string {
  const context = extractContext(systemPrompt)
  const lastMessage = history.at(-1)?.content.trim() ?? ''
  const userTurn = history.filter((message) => message.role === 'user').length

  if (history.length <= 1) return firstReply(context)

  if (/готово|понял|поняла|получилось|спасибо/iu.test(lastMessage)) {
    return 'Здорово! Ты прошёл это занятие до конца и сделал важный шаг. Продолжай в том же духе! 🏆\n\n{"session_complete": true, "xp_earned": 60, "coins_earned": 50}'
  }

  if (/не\s+знаю|не\s+понимаю|непонятно/iu.test(lastMessage)) {
    return smallerStepReply(context)
  }

  if (context.directHelp) {
    if (!context.rule) return followUpReply(context, lastMessage, userTurn)
    const neededPart = focusedRulePart(context.rule, userTurn - 2)
    return `Для быстрой помощи берём правило: ${neededPart} Шаги такие: 1) найди подходящие данные; 2) примени эту часть правила; 3) сверь результат с условием. Какой шаг разобрать подробнее для ответа «${normalizeText(lastMessage, 70)}»?`
  }

  return followUpReply(context, lastMessage, userTurn)
}
