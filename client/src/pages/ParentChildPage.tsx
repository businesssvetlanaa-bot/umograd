import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { childrenApi, type ChildCurriculum, type ChildDashboard } from '../api/children'
import {
  parentApi,
  type SessionSummary, type SessionDetail, type SessionMessage,
  type ProgressData, type WeakSpot,
} from '../api/parent'

// ─── Constants ────────────────────────────────────────────────────────────────

const SUBJECT_LABEL: Record<string, string> = {
  math: 'Математика', russian: 'Русский язык', english: 'English',
}
const SUBJECT_COLOR: Record<string, string> = {
  math: 'var(--biome-math)', russian: 'var(--biome-russian)', english: 'var(--biome-english)',
}
const SUBJECT_BG: Record<string, string> = {
  math: '#EFF6FF', russian: '#F0FDF4', english: '#FFF7ED',
}

function fmt(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) + ' ' +
         d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

// ─── Sub-components ──────────────────────────────────────────────────────────

// Progress bar row
function ProgressRow({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-gray-600 w-40 flex-shrink-0 truncate">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${value}%`, background: color }} />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right flex-shrink-0">{value}%</span>
    </div>
  )
}

// ─── Tab: Progress ────────────────────────────────────────────────────────────

function ProgressTab({ childId }: { childId: string }) {
  const [data, setData]     = useState<ProgressData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    parentApi.childProgress(childId)
      .then((d) => { setData(d); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [childId])

  if (loading) return <Spinner />
  if (error)   return <ErrorMsg msg={error} />
  if (!data)   return null

  const subjects = ['math', 'russian', 'english'] as const

  return (
    <div className="flex flex-col gap-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard emoji="📚" label="Всего сессий" value={data.total_sessions} />
        <StatCard emoji="⭐" label="Заработано XP" value={data.total_xp} />
      </div>

      {/* Subject cards */}
      {subjects.map((subj) => {
        const sp = data[subj]
        return (
          <div key={subj} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-800">{SUBJECT_LABEL[subj]}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{sp.sessions_count} сессий</p>
              </div>
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: SUBJECT_BG[subj] }}
              >
                <span className="text-2xl font-bold" style={{ color: SUBJECT_COLOR[subj] }}>
                  {sp.overall}%
                </span>
              </div>
            </div>

            {/* Overall bar */}
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${sp.overall}%`, background: SUBJECT_COLOR[subj] }}
              />
            </div>

            {/* Topics */}
            {sp.topics.length > 0 ? (
              <div className="flex flex-col gap-2">
                {sp.topics.map((tp) => (
                  <ProgressRow
                    key={tp.id}
                    label={tp.title}
                    value={tp.mastery_level}
                    color={SUBJECT_COLOR[subj]}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-2">Занятий по этому предмету ещё не было</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Sessions ────────────────────────────────────────────────────────────

function SessionsTab({ childId }: { childId: string }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [modal, setModal]       = useState<{ session: SessionDetail; messages: SessionMessage[] } | null>(null)
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    parentApi.childSessions(childId)
      .then((d) => { setSessions(d); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [childId])

  async function openSession(sessionId: string) {
    setModalLoading(true)
    try {
      const data = await parentApi.sessionMessages(childId, sessionId)
      setModal(data)
    } catch { /* ignore */ }
    finally { setModalLoading(false) }
  }

  if (loading) return <Spinner />
  if (error)   return <ErrorMsg msg={error} />

  return (
    <>
      {sessions.length === 0 ? (
        <EmptyState icon="📚" text="Занятий пока не было" />
      ) : (
        <div className="flex flex-col gap-2">
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => openSession(s.id)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:border-gray-300 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ background: SUBJECT_COLOR[s.subject] }}
                    >
                      {SUBJECT_LABEL[s.subject]}
                    </span>
                    <span className="text-xs text-gray-400">{fmt(s.started_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-700 truncate">
                    {s.topic ?? 'Тема не определена'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className={`text-xs font-semibold ${s.completed ? 'text-green-600' : 'text-gray-400'}`}>
                    {s.completed ? '✅ Завершено' : '⏸️ Не завершено'}
                  </span>
                  {s.completed && (
                    <span className="text-xs text-yellow-600 font-semibold">+{s.xp_earned} XP</span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      {(modal || modalLoading) && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {modalLoading ? (
              <div className="flex items-center justify-center py-12"><Spinner /></div>
            ) : modal && (
              <>
                {/* Modal header */}
                <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
                  <div>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ background: SUBJECT_COLOR[modal.session.subject] }}
                    >
                      {SUBJECT_LABEL[modal.session.subject]}
                    </span>
                    <h3 className="font-bold text-gray-800 mt-1">{modal.session.topic ?? 'Занятие'}</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{fmt(modal.session.started_at)}</p>
                    {modal.session.task_text && (
                      <p className="text-xs text-gray-500 mt-2 italic">«{modal.session.task_text}»</p>
                    )}
                  </div>
                  <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl mt-1">✕</button>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
                  {modal.messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && (
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-sm mr-2 flex-shrink-0 self-end"
                          style={{ background: 'var(--color-primary)' }}
                        >
                          🎓
                        </div>
                      )}
                      <div
                        className="max-w-[78%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap"
                        style={
                          msg.role === 'user'
                            ? { background: 'var(--color-primary)', color: 'white', borderBottomRightRadius: 4 }
                            : { background: '#F0F4FF', color: '#1e293b', borderBottomLeftRadius: 4 }
                        }
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Modal footer */}
                {modal.session.completed && (
                  <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3 text-sm">
                    <span className="text-green-600 font-semibold">✅ Завершено</span>
                    <span className="text-yellow-600 font-semibold">+{modal.session.xp_earned} XP</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Tab: Weak Spots ─────────────────────────────────────────────────────────

function WeakSpotsTab({ childId }: { childId: string }) {
  const [spots, setSpots]   = useState<WeakSpot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    parentApi.weakSpots(childId)
      .then((d) => { setSpots(d); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [childId])

  if (loading) return <Spinner />
  if (error)   return <ErrorMsg msg={error} />

  if (spots.length === 0) {
    return (
      <EmptyState
        icon="🌟"
        text="Слабых мест не найдено"
        sub="Всё идёт хорошо! Продолжайте заниматься."
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-gray-500">
        Темы, где было ≥2 занятий, но освоение меньше 30%
      </p>
      {spots.map((s) => (
        <div key={s.topic_id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                style={{ background: SUBJECT_COLOR[s.subject] }}
              >
                {SUBJECT_LABEL[s.subject]}
              </span>
              <h4 className="font-semibold text-gray-800 mt-2">{s.title}</h4>
              <p className="text-xs text-gray-400 mt-1">Попыток: {s.sessions_count}</p>
            </div>
            <div className="text-right flex-shrink-0">
              <div
                className="text-lg font-bold"
                style={{ color: s.mastery_level < 15 ? '#EF4444' : '#F59E0B' }}
              >
                {s.mastery_level}%
              </div>
              <div className="text-xs text-gray-400">освоено</div>
            </div>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mt-3">
            <div
              className="h-full rounded-full"
              style={{
                width: `${s.mastery_level}%`,
                background: s.mastery_level < 15 ? '#EF4444' : '#F59E0B',
              }}
            />
          </div>
          <button
            onClick={() => alert('Функция скоро появится 🚀')}
            className="mt-3 w-full py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
          >
            Назначить задание
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Tab: Curriculum ─────────────────────────────────────────────────────────

type UploadState = {
  open: boolean; name: string; grade: number; subject: string
  text: string; loading: boolean; error: string
}

function CurriculumTab({ childId }: { childId: string }) {
  const [curricula, setCurricula] = useState<ChildCurriculum[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [selected, setSelected]   = useState<string | null>(null)
  const [upload, setUpload]       = useState<UploadState>({
    open: false, name: '', grade: 3, subject: 'math', text: '', loading: false, error: '',
  })
  const [toggling, setToggling]   = useState<string | null>(null)
  const [toggleError, setToggleError] = useState('')

  const loadCurricula = useCallback((preferredId?: string) => {
    return childrenApi.curricula(childId)
      .then((d) => {
        setCurricula(d)
        setSelected((current) => preferredId ?? (current && d.some((item) => item.id === current) ? current : d[0]?.id ?? null))
        setError('')
        setLoading(false)
      })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [childId])

  useEffect(() => { void loadCurricula() }, [loadCurricula])

  async function handleUpload() {
    if (!upload.name.trim() || !upload.text.trim()) {
      setUpload((s) => ({ ...s, error: 'Заполните название и текст программы' }))
      return
    }
    setUpload((s) => ({ ...s, loading: true, error: '' }))
    try {
      const newC = await parentApi.createCurriculum({
        name: upload.name, grade: upload.grade, subject: upload.subject, text_content: upload.text,
      })
      await loadCurricula(newC.id)
      setUpload({ open: false, name: '', grade: 3, subject: 'math', text: '', loading: false, error: '' })
    } catch (e: unknown) {
      setUpload((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Ошибка' }))
    }
  }

  async function handleToggle(curriculumId: string, topicKey: string, enabled: boolean) {
    const toggleId = `${curriculumId}:${topicKey}`
    setToggling(toggleId)
    setToggleError('')
    try {
      await childrenApi.setTopicEnabled(childId, curriculumId, topicKey, enabled)
      setCurricula((prev) =>
        prev.map((c) =>
          c.id === curriculumId
            ? { ...c, topics: c.topics.map((t) => t.topic_key === topicKey ? { ...t, enabled } : t) }
            : c,
        ),
      )
    } catch (cause: unknown) {
      setToggleError(cause instanceof Error ? cause.message : 'Не удалось изменить доступность темы')
    }
    finally { setToggling(null) }
  }

  const currentCurriculum = curricula.find((c) => c.id === selected) ?? null

  if (loading) return <Spinner />
  if (error)   return <ErrorMsg msg={error} />

  return (
    <>
      {/* Selector */}
      <div className="flex items-center gap-3 mb-4">
        {curricula.length > 0 ? (
          <select
            value={selected ?? ''}
            onChange={(e) => setSelected(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:border-gray-400"
          >
            {curricula.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.is_system ? '(ФГОС)' : `· ${SUBJECT_LABEL[c.subject]}`}
              </option>
            ))}
          </select>
        ) : (
          <p className="flex-1 text-sm text-gray-400">Нет загруженных программ. Используется стандартная ФГОС.</p>
        )}
        <button
          onClick={() => setUpload((s) => ({ ...s, open: true }))}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0"
          style={{ background: 'var(--color-primary)' }}
        >
          + Загрузить
        </button>
      </div>

      {toggleError && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{toggleError}</div>}

      {/* Topics list */}
      {currentCurriculum ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-semibold text-gray-700 text-sm">{currentCurriculum.name}</h3>
            <p className="text-xs text-gray-400">{currentCurriculum.topics.length} тем</p>
          </div>
          <div className="divide-y divide-gray-100 max-h-96 overflow-y-auto">
            {currentCurriculum.topics.map((topic) => (
              <div key={topic.topic_key} className="flex items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800">{topic.title}</p>
                  {topic.description && (
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{topic.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={toggling !== null}
                  onClick={() => handleToggle(currentCurriculum.id, topic.topic_key, topic.enabled === false)}
                  className="flex flex-shrink-0 cursor-pointer items-center gap-2 mt-0.5 disabled:cursor-wait"
                  aria-label={`${topic.enabled !== false ? 'Отключить' : 'Включить'} тему ${topic.title}`}
                >
                  <div
                    className="relative w-10 h-5 rounded-full transition-colors"
                    style={{
                      background: topic.enabled !== false
                        ? 'var(--color-primary)'
                        : '#E5E7EB',
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
                      style={{
                        left: topic.enabled !== false ? 22 : 2,
                        opacity: toggling === `${currentCurriculum.id}:${topic.topic_key}` ? 0.6 : 1,
                      }}
                    />
                  </div>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState icon="📋" text="Выберите программу или загрузите свою" />
      )}

      {/* Upload modal */}
      {upload.open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
          onClick={() => !upload.loading && setUpload((s) => ({ ...s, open: false }))}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">Загрузить программу</h2>
              {!upload.loading && (
                <button onClick={() => setUpload((s) => ({ ...s, open: false }))} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              )}
            </div>

            {upload.loading ? (
              <div className="flex flex-col items-center gap-4 py-10 px-6">
                <div className="text-5xl animate-bounce">🎓</div>
                <p className="font-semibold text-gray-700">Тим анализирует программу...</p>
                <p className="text-sm text-gray-400 text-center">Обычно это занимает 10–20 секунд</p>
              </div>
            ) : (
              <div className="px-6 py-5 flex flex-col gap-4">
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Название программы</label>
                  <input
                    value={upload.name}
                    onChange={(e) => setUpload((s) => ({ ...s, name: e.target.value }))}
                    placeholder="Например: Программа Петрова 2025"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400"
                  />
                </div>

                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Предмет</label>
                    <select
                      value={upload.subject}
                      onChange={(e) => setUpload((s) => ({ ...s, subject: e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white"
                    >
                      <option value="math">Математика</option>
                      <option value="russian">Русский язык</option>
                      <option value="english">English</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Класс</label>
                    <select
                      value={upload.grade}
                      onChange={(e) => setUpload((s) => ({ ...s, grade: +e.target.value }))}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400 bg-white"
                    >
                      {[1, 2, 3, 4].map((g) => <option key={g} value={g}>{g} класс</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">
                    Текст программы
                  </label>
                  <textarea
                    value={upload.text}
                    onChange={(e) => setUpload((s) => ({ ...s, text: e.target.value }))}
                    rows={6}
                    placeholder="Вставьте текст программы или список тем. Например:
1. Сложение и вычитание в пределах 100
2. Умножение и деление
3. Дроби..."
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-400 resize-none"
                  />
                </div>

                {upload.error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">
                    {upload.error}
                  </div>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!upload.name.trim() || !upload.text.trim()}
                  className="w-full py-3 rounded-xl font-bold text-white disabled:opacity-40 transition-all"
                  style={{ background: 'var(--color-primary)' }}
                >
                  Загрузить и проанализировать
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center py-12 text-gray-400">
      <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
    </div>
  )
}
function ErrorMsg({ msg }: { msg: string }) {
  return <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{msg}</div>
}
function EmptyState({ icon, text, sub }: { icon: string; text: string; sub?: string }) {
  return (
    <div className="text-center py-12 text-gray-400">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-semibold text-gray-600">{text}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  )
}
function StatCard({ emoji, label, value }: { emoji: string; label: string; value: number }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center gap-3">
      <span className="text-2xl">{emoji}</span>
      <div>
        <div className="font-bold text-gray-800 text-xl">{value}</div>
        <div className="text-xs text-gray-400">{label}</div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = 'progress' | 'sessions' | 'weak' | 'curriculum'

const TABS: { key: Tab; label: string }[] = [
  { key: 'progress',   label: 'Прогресс' },
  { key: 'sessions',   label: 'История' },
  { key: 'weak',       label: 'Слабые места' },
  { key: 'curriculum', label: 'Программа' },
]

const AVATAR_EMOJI: Record<string, string> = {
  explorer: '🧭', witch: '🔮', builder: '🔨', ranger: '🗺️',
}

export default function ParentChildPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [child, setChild]     = useState<ChildDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('progress')
  const [savingHelpMode, setSavingHelpMode] = useState(false)
  const [helpModeError, setHelpModeError] = useState('')
  const [pinValue, setPinValue] = useState('')
  const [savingPin, setSavingPin] = useState(false)
  const [pinMessage, setPinMessage] = useState('')
  const [pinError, setPinError] = useState('')

  useEffect(() => {
    if (!id) return
    childrenApi.dashboard(id)
      .then((d) => { setChild(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function toggleHelpMode() {
    if (!id || !child || savingHelpMode) return
    const nextValue = !child.direct_answer_allowed
    setSavingHelpMode(true)
    setHelpModeError('')
    try {
      await childrenApi.update(id, { direct_answer_allowed: nextValue })
      setChild({ ...child, direct_answer_allowed: nextValue })
    } catch (error: unknown) {
      setHelpModeError(error instanceof Error ? error.message : 'Не удалось изменить режим помощи')
    } finally {
      setSavingHelpMode(false)
    }
  }

  async function savePin() {
    if (!id || !child || savingPin) return
    if (!/^\d{4}$/u.test(pinValue)) { setPinError('Введите ровно 4 цифры'); return }
    setSavingPin(true); setPinError(''); setPinMessage('')
    try {
      await childrenApi.setPin(id, pinValue)
      setChild({ ...child, has_pin: true }); setPinValue('')
      setPinMessage(child.has_pin ? 'PIN-код изменён' : 'Самостоятельный вход включён')
    } catch (error: unknown) { setPinError(error instanceof Error ? error.message : 'Не удалось сохранить PIN-код') }
    finally { setSavingPin(false) }
  }

  async function disablePin() {
    if (!id || !child || savingPin) return
    setSavingPin(true); setPinError(''); setPinMessage('')
    try {
      await childrenApi.disablePin(id)
      setChild({ ...child, has_pin: false }); setPinValue('')
      setPinMessage('Самостоятельный вход выключен')
    } catch (error: unknown) { setPinError(error instanceof Error ? error.message : 'Не удалось выключить PIN-код') }
    finally { setSavingPin(false) }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate('/parent/dashboard')}
          className="text-gray-400 hover:text-gray-700 transition-colors font-bold text-lg"
        >
          ←
        </button>
        {child && (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
              style={{ background: '#EDE9FE' }}
            >
              {AVATAR_EMOJI[child.avatar_type] ?? '🎮'}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-gray-800 truncate">{child.name}</h1>
              <p className="text-xs text-gray-400">{child.grade} класс · Уровень {child.level} · {child.xp} XP</p>
            </div>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 sticky top-[69px] z-10">
        <div className="max-w-2xl mx-auto px-2 flex overflow-x-auto scrollbar-hide">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-[var(--color-primary)] text-[var(--color-primary)]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {child && (
          <section className="mb-5 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-gray-800">Как Тим помогает с заданиями</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {child.direct_answer_allowed
                    ? 'Быстрая помощь включена: Тим может показать полное решение и обязательно объяснит каждый шаг.'
                    : 'Обычный режим: Тим объясняет тему, даёт подсказки и помогает ребёнку найти ответ.'}
                </p>
              </div>
              <button
                type="button"
                onClick={toggleHelpMode}
                disabled={savingHelpMode}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50 ${child.direct_answer_allowed ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
              >
                {savingHelpMode
                  ? 'Сохраняем…'
                  : child.direct_answer_allowed
                    ? '✓ Быстрая помощь включена'
                    : 'Включить быструю помощь'}
              </button>
            </div>
            {helpModeError && <p className="mt-3 text-sm font-semibold text-red-600">{helpModeError}</p>}
          </section>
        )}
        {child && (
          <section className="mb-5 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm">
            <h2 className="font-bold text-gray-800">Самостоятельный вход ребёнка</h2>
            <p className="mt-1 text-sm text-gray-500">{child.has_pin ? 'Вход по PIN включён. Можно задать новый код или выключить самостоятельный вход.' : 'Вход ребёнка без родителя выключен. Установите PIN из 4 цифр, чтобы включить его.'}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input type="password" inputMode="numeric" autoComplete="new-password" maxLength={4}
                aria-label={child.has_pin ? 'Новый PIN-код' : 'PIN-код ребёнка'} placeholder={child.has_pin ? 'Новый PIN' : '4 цифры'}
                value={pinValue} onChange={(event) => { setPinValue(event.target.value.replace(/\D/g, '')); setPinError(''); setPinMessage('') }}
                className="min-h-11 rounded-xl border-2 border-gray-200 bg-gray-50 px-4 text-center text-lg tracking-[.35em] outline-none transition focus:border-teal-500 focus:bg-white" />
              <button type="button" onClick={() => { void savePin() }} disabled={savingPin || pinValue.length !== 4} className="min-h-11 rounded-xl bg-teal-600 px-4 text-sm font-bold text-white transition hover:bg-teal-700 disabled:opacity-50">
                {savingPin ? 'Сохраняем…' : child.has_pin ? 'Сменить PIN' : 'Установить PIN'}
              </button>
              {child.has_pin && <button type="button" onClick={() => { void disablePin() }} disabled={savingPin} className="min-h-11 rounded-xl border border-red-200 px-4 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50">Выключить вход</button>}
            </div>
            {pinMessage && <p className="mt-3 text-sm font-semibold text-emerald-600">{pinMessage}</p>}
            {pinError && <p className="mt-3 text-sm font-semibold text-red-600">{pinError}</p>}
          </section>
        )}
        {id && activeTab === 'progress'   && <ProgressTab childId={id} />}
        {id && activeTab === 'sessions'   && <SessionsTab childId={id} />}
        {id && activeTab === 'weak'       && <WeakSpotsTab childId={id} />}
        {id && activeTab === 'curriculum' && <CurriculumTab childId={id} />}
      </main>
    </div>
  )
}
