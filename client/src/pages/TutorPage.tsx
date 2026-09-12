import { useRef, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { sessionsApi } from '../api/sessions'
import timMascot from '../assets/tim-mascot.png'

type InputMode = 'subject' | 'activity' | 'choose' | 'preview' | 'text' | 'topic'
type Subject = 'math' | 'russian' | 'english'
type Activity = 'homework' | 'learn' | 'practice'

const SUBJECT_LABELS: Record<Subject, string> = {
  math:    'Математика',
  russian: 'Русский',
  english: 'English',
}

const SUBJECT_COLORS: Record<Subject, string> = {
  math:    'var(--biome-math)',
  russian: 'var(--biome-russian)',
  english: 'var(--biome-english)',
}

async function prepareImage(file: File): Promise<{ base64: string; mimeType: 'image/jpeg' }> {
  const supported = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  if (!supported.includes(file.type)) {
    throw new Error('Этот формат фото не поддерживается. Выбери JPEG, PNG или сделай новый снимок камерой.')
  }

  const bitmap = await createImageBitmap(file)
  const maxSide = 1600
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Не удалось подготовить фотографию')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
  return { base64: dataUrl.split(',')[1] ?? '', mimeType: 'image/jpeg' }
}

export default function TutorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const location = useLocation()
  const locationSubject = (location.state as { subject?: Subject } | null)?.subject

  const cameraRef  = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)

  const [mode, setMode]           = useState<InputMode>(locationSubject ? 'activity' : 'subject')
  const [activity, setActivity]   = useState<Activity>('homework')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>('')
  const [taskText, setTaskText]   = useState('')
  const [taskHint, setTaskHint]   = useState('')
  const [subject, setSubject]     = useState<Subject>(locationSubject ?? 'math')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  function handleFileSelect(file: File) {
    if (!file.type.startsWith('image/')) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
    setMode('preview')
    setError('')
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileSelect(file)
    e.target.value = ''
  }

  async function submitPhoto() {
    if (!imageFile || !id) return
    setLoading(true)
    setError('')
    try {
      const { base64, mimeType } = await prepareImage(imageFile)
      const res = await sessionsApi.start({
        child_id:        id,
        image_base64:    base64,
        image_mime_type: mimeType,
        subject,
        task_hint:       taskHint.trim() || undefined,
      })
      navigate(`/child/${id}/session/${res.session_id}`, { state: { photoPreview: imagePreview } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось прочитать задание. Сделай фото чётче или напиши текст вручную')
      setLoading(false)
    }
  }

  async function submitText() {
    if (!taskText.trim() || !id) return
    setLoading(true)
    setError('')
    try {
      const res = await sessionsApi.start({
        child_id:  id,
        task_text: taskText.trim(),
        subject,
      })
      navigate(`/child/${id}/session/${res.session_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сервера')
      setLoading(false)
    }
  }

  async function submitTopic() {
    if (!taskText.trim() || !id) return
    setLoading(true)
    setError('')
    try {
      const instruction = activity === 'learn'
        ? `Объясни мне тему «${taskText.trim()}» с самого начала и помоги её понять.`
        : `Проведи тренировку по теме «${taskText.trim()}»: задавай задания по одному, проверяй ответы и давай подсказки.`
      const res = await sessionsApi.start({ child_id: id, task_text: instruction, subject })
      navigate(`/child/${id}/session/${res.session_id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка сервера')
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-6"
        style={{ background: 'var(--color-bg)' }}
      >
        <div className="text-7xl animate-bounce">🎓</div>
        <p className="text-xl font-bold text-gray-700 text-center px-4">
          Тим готовит занятие...
        </p>
        <div className="flex gap-2 mt-2">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="w-3 h-3 rounded-full"
              style={{
                background: 'var(--color-primary)',
                animation: `bounce 1s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center px-4 py-6 sm:py-8 bg-[radial-gradient(circle_at_12%_0%,#dbeafe_0,transparent_28%),radial-gradient(circle_at_88%_8%,#ccfbf1_0,transparent_25%),#f5f7ff]"
      >
      {/* Скрытые input-элементы */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onInputChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onInputChange}
      />

      {/* Шапка */}
      <div className="w-full max-w-3xl mb-6">
        <button
          onClick={() => navigate(`/child/${id}/world`)}
          className="flex items-center gap-2 text-gray-500 hover:text-gray-700 text-sm font-semibold mb-4 transition-colors"
        >
          ← В мой мир
        </button>
        <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#312e81,#0f766e)] px-6 py-6 text-left shadow-xl sm:px-8">
          <span className="absolute left-[44%] top-4 text-amber-300">✦</span>
          <img src={timMascot} alt="Тим" className="absolute -bottom-20 right-1 w-40 drop-shadow-xl sm:-bottom-28 sm:right-4 sm:w-56" style={{ maskImage: 'linear-gradient(to bottom, black 72%, transparent 99%)' }} />
          <p className="mb-1 text-xs font-black uppercase tracking-[.18em] text-amber-300">Репетитор Умограда</p>
          <h1 className="relative z-10 max-w-[68%] text-2xl font-black text-white mb-1 sm:text-3xl">Занятие с Тимом 🎓</h1>
          <p className="relative z-10 max-w-[65%] text-indigo-100 text-sm">
            Выбери предмет и скажи, с чем помочь
          </p>
        </div>
      </div>

      <div className="w-full max-w-3xl flex flex-col gap-4 rounded-[28px] border border-white bg-white/75 p-4 shadow-[0_18px_50px_rgba(49,46,129,.1)] backdrop-blur sm:p-6">

        {mode === 'subject' && (
          <>
            <h2 className="text-lg font-bold text-gray-800">1. Какой предмет будем изучать?</h2>
            {(Object.keys(SUBJECT_LABELS) as Subject[]).map(s => (
              <button
                key={s}
                onClick={() => { setSubject(s); setMode('activity') }}
                className="w-full p-5 rounded-2xl text-left font-bold text-white text-lg shadow-sm active:scale-95 transition-transform"
                style={{ background: SUBJECT_COLORS[s] }}
              >
                {s === 'math' ? '➗' : s === 'russian' ? '📖' : '🔤'} {SUBJECT_LABELS[s]}
              </button>
            ))}
          </>
        )}

        {mode === 'activity' && (
          <>
            <button onClick={() => setMode('subject')} className="self-start text-sm font-semibold text-gray-500">← Изменить предмет</button>
            <div className="rounded-xl px-4 py-3 text-white font-bold" style={{ background: SUBJECT_COLORS[subject] }}>
              {SUBJECT_LABELS[subject]}
            </div>
            <h2 className="text-lg font-bold text-gray-800">2. Что хочешь сделать?</h2>
            <button
              onClick={() => { setActivity('learn'); setTaskText(''); setMode('topic') }}
              className="flex items-center gap-4 p-5 rounded-2xl bg-white shadow-sm text-left"
            >
              <span className="text-4xl">💡</span><div><div className="font-bold text-lg">Изучить тему</div><div className="text-sm text-gray-500">Объяснение с самого начала</div></div>
            </button>
            <button
              onClick={() => { setActivity('practice'); setTaskText(''); setMode('topic') }}
              className="flex items-center gap-4 p-5 rounded-2xl bg-white shadow-sm text-left"
            >
              <span className="text-4xl">🎯</span><div><div className="font-bold text-lg">Потренироваться</div><div className="text-sm text-gray-500">Задания и подсказки по теме</div></div>
            </button>
            <button
              onClick={() => { setActivity('homework'); setMode('choose') }}
              className="flex items-center gap-4 p-5 rounded-2xl bg-white shadow-sm text-left"
            >
              <span className="text-4xl">📚</span><div><div className="font-bold text-lg">Разобрать домашнее задание</div><div className="text-sm text-gray-500">Фото, галерея или текст</div></div>
            </button>
          </>
        )}

        {mode === 'topic' && (
          <>
            <button onClick={() => setMode('activity')} className="self-start text-sm font-semibold text-gray-500">← Выбрать другую цель</button>
            <div className="rounded-xl px-4 py-3 text-white font-bold" style={{ background: SUBJECT_COLORS[subject] }}>
              {SUBJECT_LABELS[subject]} · {activity === 'learn' ? 'Изучение темы' : 'Тренировка'}
            </div>
            <label className="font-bold text-gray-800">Какую тему будем разбирать?</label>
            <textarea
              value={taskText}
              onChange={e => setTaskText(e.target.value)}
              placeholder="Например: дроби, части речи, Present Simple..."
              rows={4}
              className="w-full p-4 rounded-2xl border-2 border-gray-200 focus:border-[var(--color-primary)] outline-none resize-none bg-white"
            />
            {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>}
            <button
              onClick={submitTopic}
              disabled={!taskText.trim()}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}
            >
              Начать занятие →
            </button>
          </>
        )}

        {/* ─── Режим выбора способа ─── */}
        {mode === 'choose' && (
          <>
            <button onClick={() => setMode('activity')} className="self-start text-sm font-semibold text-gray-500">← Выбрать другую цель</button>
            <div className="rounded-xl px-4 py-3 text-white font-bold" style={{ background: SUBJECT_COLORS[subject] }}>
              {SUBJECT_LABELS[subject]} · Домашнее задание
            </div>
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex items-center gap-4 p-5 rounded-2xl bg-white shadow-sm border-2 border-transparent hover:border-[var(--color-primary)] transition-all text-left"
            >
              <span className="text-4xl">📷</span>
              <div>
                <div className="font-bold text-gray-800 text-lg">Сфотографировать</div>
                <div className="relative z-10 max-w-[65%] text-indigo-100 text-sm">Открою камеру</div>
              </div>
            </button>

            <button
              onClick={() => galleryRef.current?.click()}
              className="flex items-center gap-4 p-5 rounded-2xl bg-white shadow-sm border-2 border-transparent hover:border-[var(--color-primary)] transition-all text-left"
            >
              <span className="text-4xl">🖼️</span>
              <div>
                <div className="font-bold text-gray-800 text-lg">Выбрать из галереи</div>
                <div className="relative z-10 max-w-[65%] text-indigo-100 text-sm">Выберу фото с устройства</div>
              </div>
            </button>

            <button
              onClick={() => { setMode('text'); setError('') }}
              className="flex items-center gap-4 p-5 rounded-2xl bg-white shadow-sm border-2 border-transparent hover:border-[var(--color-primary)] transition-all text-left"
            >
              <span className="text-4xl">✏️</span>
              <div>
                <div className="font-bold text-gray-800 text-lg">Написать текст</div>
                <div className="relative z-10 max-w-[65%] text-indigo-100 text-sm">Введу задание вручную</div>
              </div>
            </button>
          </>
        )}

        {/* ─── Режим превью фото ─── */}
        {mode === 'preview' && (
          <>
            <div className="rounded-2xl overflow-hidden shadow-md bg-white p-2">
              <img
                src={imagePreview}
                alt="Превью задания"
                className="w-full rounded-xl object-contain max-h-64"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-bold text-gray-700">
                Какое задание разбираем? <span className="text-gray-400 font-normal">(необязательно)</span>
              </label>
              <input
                type="text"
                value={taskHint}
                onChange={e => setTaskHint(e.target.value)}
                placeholder="Например: задание 3, упражнение 5, первый абзац..."
                className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-base outline-none focus:border-[var(--color-primary)] transition bg-white"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={submitPhoto}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg shadow-md active:scale-95 transition-transform"
              style={{ background: 'var(--color-primary)' }}
            >
              Отправить репетитору →
            </button>

            <button
              onClick={() => { setMode('choose'); setImageFile(null); setImagePreview(''); setTaskHint(''); setError('') }}
              className="w-full py-3 rounded-2xl font-semibold text-gray-600 bg-white border border-gray-200"
            >
              ← Выбрать другой способ
            </button>
          </>
        )}

        {/* ─── Режим текстового ввода ─── */}
        {mode === 'text' && (
          <>
            {/* Выбор предмета */}
            <div className="flex gap-3">
              {(Object.keys(SUBJECT_LABELS) as Subject[]).map(s => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className="flex-1 py-3 rounded-xl font-bold text-white text-sm transition-all active:scale-95"
                  style={{
                    background: subject === s ? SUBJECT_COLORS[s] : '#e5e7eb',
                    color: subject === s ? 'white' : '#6b7280',
                  }}
                >
                  {SUBJECT_LABELS[s]}
                </button>
              ))}
            </div>

            <textarea
              value={taskText}
              onChange={e => setTaskText(e.target.value)}
              placeholder="Напиши сюда текст задания..."
              rows={5}
              className="w-full p-4 rounded-2xl border-2 border-gray-200 focus:border-[var(--color-primary)] outline-none resize-none text-gray-800 text-base bg-white"
            />

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={submitText}
              disabled={!taskText.trim()}
              className="w-full py-4 rounded-2xl font-bold text-white text-lg shadow-md active:scale-95 transition-transform disabled:opacity-40"
              style={{ background: 'var(--color-primary)' }}
            >
              Отправить →
            </button>

            <button
              onClick={() => { setMode('choose'); setError('') }}
              className="w-full py-3 rounded-2xl font-semibold text-gray-600 bg-white border border-gray-200"
            >
              ← Назад
            </button>
          </>
        )}
      </div>
    </div>
  )
}
