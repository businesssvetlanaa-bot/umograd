import { PrismaClient, Subject } from '@prisma/client'

const prisma = new PrismaClient()

const SUBJECT_MAP: Record<string, Subject> = {
  math:    Subject.math,
  russian: Subject.russian,
  english: Subject.english,
}

export async function findTopic(subject: string, taskText: string) {
  const subjectEnum = SUBJECT_MAP[subject]
  if (!subjectEnum) return null

  const topics = await prisma.topic.findMany({
    where: { subject: subjectEnum, grade: 4 },
    orderBy: { order: 'asc' },
  })

  if (topics.length === 0) return null

  const haystack = taskText.toLowerCase()
  const tokens = new Set(haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean))
  let bestTopic: (typeof topics)[number] | null = null
  let bestScore = 0

  for (const topic of topics) {
    let score = 0
    const keywords = Array.isArray(topic.keywords)
      ? topic.keywords.filter((value): value is string => typeof value === 'string')
      : []
    for (const kw of keywords) {
      const keyword = kw.trim().toLowerCase()
      if (!keyword) continue
      const matches = keyword.length <= 2 ? tokens.has(keyword) : haystack.includes(keyword)
      if (matches) score++
    }
    // также проверяем совпадение с названием темы
    if (haystack.includes(topic.title.toLowerCase())) score += 2
    if (score > bestScore) {
      bestScore = score
      bestTopic = topic
    }
  }

  return bestTopic
}
