import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { childrenApi } from '../api/children'

const AVATAR_EMOJI: Record<string, string> = {
  explorer: '🧭', witch: '🔮', builder: '🔨', ranger: '🗺️',
}
const AVATAR_BG: Record<string, string> = {
  blue: '#DBEAFE', green: '#DCFCE7', orange: '#FFEDD5', purple: '#EDE9FE',
}
const AVATAR_ACCENT: Record<string, string> = {
  blue: '#3B82F6', green: '#22C55E', orange: '#F97316', purple: '#8B5CF6',
}

function formatDate(iso: string | null) {
  if (!iso) return 'никогда'
  const d = new Date(iso)
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ChildCard {
  id: string; name: string; avatar_type: string; avatar_color: string
  grade: number
  xp: number; level: number; coins: number; streak_days: number; last_active: string | null
}

export default function ParentDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [children, setChildren] = useState<ChildCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    childrenApi.list()
      .then((data) => { setChildren(data); setLoading(false) })
      .catch((e: Error) => { setError(e.message); setLoading(false) })
  }, [])

  function handleLogout() { logout(); navigate('/login') }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* ── Header ── */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-sm" style={{ color: 'var(--color-primary)' }}>Умоград</span>
          <span className="text-gray-300">|</span>
          <span className="text-gray-600 font-semibold text-sm">Кабинет родителя</span>
        </div>
        <div className="flex items-center gap-4">
          {user && <span className="text-gray-500 text-sm hidden sm:block">{user.name}</span>}
          <button
            type="button"
            onClick={() => navigate('/parent/settings')}
            className="text-sm text-gray-500 hover:text-indigo-700 transition-colors font-medium"
          >
            {'\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0438'}
          </button>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors font-medium"
          >
            Выйти
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">

        {/* ── Welcome ── */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Добро пожаловать{user ? `, ${user.name}` : ''}!
          </h1>
          <p className="text-gray-500 mt-1">Следите за успехами ваших детей</p>
        </div>

        {/* ── Children ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-800">Мои дети</h2>
            <button
              onClick={() => navigate('/onboarding')}
              className="text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              style={{ background: 'var(--color-primary)', color: 'white' }}
            >
              + Добавить ребёнка
            </button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <div className="text-4xl animate-spin">⚙️</div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">{error}</div>
          )}

          {!loading && !error && children.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <div className="text-5xl mb-4">👶</div>
              <p className="font-semibold text-gray-600">Детей пока нет</p>
              <p className="text-sm mt-1">Добавьте первого ребёнка, чтобы начать</p>
              <button
                onClick={() => navigate('/onboarding')}
                className="mt-4 px-6 py-2 rounded-xl text-white font-semibold text-sm"
                style={{ background: 'var(--color-primary)' }}
              >
                Добавить ребёнка
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {children.map((child) => {
              const bg     = AVATAR_BG[child.avatar_color]     || '#F3F4F6'
              const accent = AVATAR_ACCENT[child.avatar_color] || '#4F46E5'
              return (
                <div key={child.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
                  <div className="flex items-start gap-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                      style={{ background: bg }}
                    >
                      {AVATAR_EMOJI[child.avatar_type] || '🎮'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-gray-900 text-lg">{child.name}</h3>
                      <p className="text-sm text-gray-400">{child.grade} класс · Уровень {child.level}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Последний вход: {formatDate(child.last_active)}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1 text-gray-600">
                      <span>⭐</span><span className="font-semibold">{child.xp}</span><span className="text-gray-400">XP</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <span>💰</span><span className="font-semibold">{child.coins}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <span>🔥</span><span className="font-semibold">{child.streak_days}</span><span className="text-gray-400">дн.</span>
                    </div>
                  </div>

                  <div>
                    <button
                      onClick={() => navigate(`/parent/children/${child.id}`)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold text-white transition-all active:scale-95"
                      style={{ background: accent }}
                    >
                      Подробнее
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}
