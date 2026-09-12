import { PrismaClient, Subject } from '@prisma/client'
import topicsData from './topics_fgos.json'

const prisma = new PrismaClient()

type SubjectKey = 'math' | 'russian' | 'english'

const SUBJECT_MAP: Record<SubjectKey, Subject> = {
  math: Subject.math,
  russian: Subject.russian,
  english: Subject.english,
}

async function seedTopics() {
  console.log('🌱 Загружаю темы ФГОС в базу данных...')

  let totalCreated = 0

  for (const [subjectKey, topics] of Object.entries(topicsData.subjects) as [SubjectKey, typeof topicsData.subjects.math][]) {
    const subject = SUBJECT_MAP[subjectKey]

    console.log(`\n📚 Предмет: ${subjectKey} (${topics.length} тем)`)

    for (const topic of topics) {
      const existing = await prisma.topic.findFirst({
        where: { subject, order: topic.order },
      })

      if (existing) {
        await prisma.topic.update({
          where: { id: existing.id },
          data: {
            title: topic.title,
            description: topic.description,
            keywords: topic.keywords,
            rules: topic.rules,
            grade: topicsData.grade,
          },
        })
        console.log(`  ✏️  Обновлено: [${topic.order}] ${topic.title}`)
      } else {
        await prisma.topic.create({
          data: {
            subject,
            title: topic.title,
            description: topic.description,
            keywords: topic.keywords,
            rules: topic.rules,
            grade: topicsData.grade,
            order: topic.order,
          },
        })
        console.log(`  ✅ Создано: [${topic.order}] ${topic.title}`)
        totalCreated++
      }
    }
  }

  console.log(`\n🎉 Готово! Создано новых тем: ${totalCreated}`)
}

async function seedSystemCurricula() {
  console.log('\n📋 Создаю системные программы ФГОС...')

  const subjects: SubjectKey[] = ['math', 'russian', 'english']
  const subjectNames: Record<SubjectKey, string> = {
    math: 'Математика',
    russian: 'Русский язык',
    english: 'Английский язык',
  }

  for (const subjectKey of subjects) {
    const subject = SUBJECT_MAP[subjectKey]
    const topics = topicsData.subjects[subjectKey]

    const existing = await prisma.curriculum.findFirst({
      where: { is_system: true, subject },
    })

    const topicsJson = topics.map((t) => ({
      order: t.order,
      title: t.title,
      description: t.description,
      enabled: true,
    }))

    if (existing) {
      await prisma.curriculum.update({
        where: { id: existing.id },
        data: { name: `Стандартная ФГОС — ${subjectNames[subjectKey]}, ${topicsData.grade} класс`, grade: topicsData.grade, topics: topicsJson },
      })
      console.log(`  ✏️  Обновлена программа: ${subjectNames[subjectKey]}`)
    } else {
      await prisma.curriculum.create({
        data: {
          name: `Стандартная ФГОС — ${subjectNames[subjectKey]}, ${topicsData.grade} класс`,
          grade: topicsData.grade,
          subject,
          is_system: true,
          topics: topicsJson,
        },
      })
      console.log(`  ✅ Создана программа: ${subjectNames[subjectKey]}`)
    }
  }
}

async function main() {
  await seedTopics()
  await seedSystemCurricula()
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
