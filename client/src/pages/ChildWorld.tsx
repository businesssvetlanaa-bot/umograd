import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { childrenApi, type ChildDashboard, type BuildingItem } from '../api/children'
import { useAuth } from '../hooks/useAuth'
import WorldMap, { type PlacedBuilding } from './WorldMap'

const AVATAR_EMOJI: Record<string, string> = {
  explorer: '🧭',
  witch:    '🔮',
  builder:  '🔨',
  ranger:   '🗺️',
}

const AVATAR_COLOR_ACCENT: Record<string, string> = {
  blue:   '#3B82F6',
  green:  '#22C55E',
  orange: '#F97316',
  purple: '#8B5CF6',
}

const SUBJECTS = [
  { key: 'math',    label: 'Математика', color: 'var(--biome-math)' },
  { key: 'russian', label: 'Русский',    color: 'var(--biome-russian)' },
  { key: 'english', label: 'English',    color: 'var(--biome-english)' },
]

// ─── Build Panel ──────────────────────────────────────────────────────────────

interface BuildPanelProps {
  buildings: BuildingItem[]
  coins: number
  onClose: () => void
  onPlace: (building_type: string, emoji: string) => void
}

function BuildPanel({ buildings, coins, onClose, onPlace }: BuildPanelProps) {
  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      className="absolute top-0 right-0 h-full w-full sm:w-72 flex flex-col shadow-2xl z-30"
      style={{ background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
        <h2 className="text-white font-bold text-lg">🏗️ Строительство</h2>
        <div className="flex items-center gap-3">
          <span className="text-yellow-300 font-bold text-sm">💰 {coins}</span>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white text-xl transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Building grid */}
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-2 content-start">
        {buildings.map((b) => {
          const locked = !b.unlocked
          return (
            <div
              key={b.building_type}
              className="rounded-xl p-3 flex flex-col items-center gap-1 text-center transition-all"
              style={{
                background: locked ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
                opacity: locked ? 0.55 : 1,
              }}
            >
              <span className="text-3xl">{locked ? '🔒' : b.emoji}</span>
              <span className="text-white font-bold text-xs leading-tight">{b.name}</span>

              {locked ? (
                <p className="text-white/40 text-xs leading-tight mt-1">{b.unlock_hint}</p>
              ) : (
                <>
                  <span className="text-yellow-300 text-xs font-bold">
                    {b.owned ? 'Есть ✓' : `💰 ${b.cost}`}
                  </span>
                  <button
                    onClick={() => onPlace(b.building_type, b.emoji)}
                    className="mt-1 w-full py-1 rounded-lg text-xs font-bold text-white transition-all active:scale-95"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    {b.placed ? 'Переместить' : 'Поставить'}
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChildWorld() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { exitChild } = useAuth()

  const [dashboard, setDashboard]       = useState<ChildDashboard | null>(null)
  const [buildingList, setBuildingList] = useState<BuildingItem[]>([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')

  const [showBuildPanel, setShowBuildPanel]   = useState(false)
  const [placingBuilding, setPlacingBuilding] = useState<string | null>(null)
  const [placingEmoji, setPlacingEmoji]       = useState('')

  // Initial load
  useEffect(() => {
    if (!id) return
    Promise.all([
      childrenApi.dashboard(id),
      childrenApi.buildings(id),
    ])
      .then(([dash, buildings]) => {
        setDashboard(dash)
        setBuildingList(buildings)
        setLoading(false)
      })
      .catch((e: Error) => {
        setError(e.message || 'Ошибка загрузки')
        setLoading(false)
      })
  }, [id])

  const placedBuildings: PlacedBuilding[] = buildingList
    .filter((b) => b.placed && b.position_x !== null && b.position_y !== null)
    .map((b) => ({
      building_type: b.building_type,
      emoji:         b.emoji,
      position_x:    b.position_x!,
      position_y:    b.position_y!,
    }))

  function handlePortalClick(subject: string) {
    navigate(`/child/${id}/tutor`, { state: { subject } })
  }

  async function handlePlaceBuilding(x: number, y: number) {
    if (!placingBuilding || !id) return
    const emoji = placingEmoji
    setPlacingBuilding(null)
    setPlacingEmoji('')
    try {
      await childrenApi.placeBuilding(id, { building_type: placingBuilding, position_x: x, position_y: y })
      const [dash, buildings] = await Promise.all([
        childrenApi.dashboard(id),
        childrenApi.buildings(id),
      ])
      setDashboard(dash)
      setBuildingList(buildings)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Ошибка'
      alert(msg)
    }
  }

  function startPlacing(building_type: string, emoji: string) {
    setShowBuildPanel(false)
    setPlacingBuilding(building_type)
    setPlacingEmoji(emoji)
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#22c55e' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-5xl"
        >
          ⚙️
        </motion.div>
      </div>
    )
  }

  // ── Error ──
  if (error || !dashboard) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8" style={{ background: 'var(--color-bg)' }}>
        <p className="text-red-500 font-semibold">{error || 'Профиль не найден'}</p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 rounded-xl font-bold text-white"
          style={{ background: 'var(--color-primary)' }}
        >
          Назад
        </button>
      </div>
    )
  }

  const accentColor = AVATAR_COLOR_ACCENT[dashboard.avatar_color] || '#4F46E5'

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: '100vw', height: '100dvh', minHeight: 400, background: '#22c55e' }}
    >
      {/* ── Phaser World ── */}
      <WorldMap
        avatarColor={dashboard.avatar_color}
        placedBuildings={placedBuildings}
        placingBuilding={placingBuilding}
        placingEmoji={placingEmoji}
        onPortalClick={handlePortalClick}
        onPlaceBuilding={handlePlaceBuilding}
      />

      {/* ── React Overlay (pointer-events: none контейнер) ── */}
      <div className="absolute inset-0 z-10 flex flex-col justify-between" style={{ pointerEvents: 'none' }}>

        {/* TOP HUD */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            pointerEvents: 'auto',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
          }}
        >
          {/* Avatar */}
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: accentColor }}
          >
            {AVATAR_EMOJI[dashboard.avatar_type] ?? '🎮'}
          </div>

          {/* Name */}
          <span className="text-white font-bold text-sm flex-1 truncate min-w-0">
            {dashboard.name}
          </span>

          {/* Stats */}
          <div className="flex items-center gap-2 text-sm font-bold flex-shrink-0">
            <span className="text-yellow-300 text-xs sm:text-sm">⭐ {dashboard.xp}</span>
            <span className="text-yellow-200 text-xs sm:text-sm">💰 {dashboard.coins}</span>
            <span className="hidden sm:inline text-orange-300">🔥 {dashboard.streak_days}</span>
          </div>

          {/* Logout */}
          <button
            onClick={async () => {
              const returnedToParent = await exitChild()
              navigate(returnedToParent ? '/parent/dashboard' : '/login')
            }}
            className="text-white/50 hover:text-white text-xs ml-1 transition-colors flex-shrink-0"
          >
            К родителю
          </button>
        </div>

        {/* BOTTOM PANEL */}
        <div style={{ pointerEvents: 'auto' }}>
          {/* Subject progress bars */}
          <div
            className="px-4 py-3 flex flex-col gap-1"
            style={{ background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)' }}
          >
            {SUBJECTS.map((subj) => {
              const prog = dashboard.subject_progress.find((p) => p.subject === subj.key)
              const pct  = prog?.mastery_level ?? 0
              return (
                <div key={subj.key} className="flex items-center gap-2">
                  <span className="text-white/70 text-xs w-20 flex-shrink-0">{subj.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: subj.color }}
                    />
                  </div>
                  <span className="text-white/50 text-xs w-8 text-right flex-shrink-0">{pct}%</span>
                </div>
              )
            })}
          </div>

          {/* Action buttons */}
          <div
            className="flex gap-3 px-4 py-3"
            style={{ background: 'rgba(15, 23, 42, 0.8)' }}
          >
            <Link
              to={`/child/${id}/tutor`}
              className="flex-1 py-3 rounded-2xl font-bold text-white text-xs sm:text-sm text-center active:scale-95 transition-transform shadow-md"
              style={{ background: 'var(--color-primary)' }}
            >
              🎓 <span>Репетитор</span>
            </Link>
            <button
              onClick={() => setShowBuildPanel(true)}
              className="flex-1 py-3 rounded-2xl font-bold text-white text-xs sm:text-sm active:scale-95 transition-transform shadow-md"
              style={{ background: 'var(--color-secondary)' }}
            >
              🏠 Строить
            </button>
          </div>
        </div>
      </div>

      {/* Placement hint */}
      <AnimatePresence>
        {placingBuilding && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl"
            style={{ background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(8px)', pointerEvents: 'auto' }}
          >
            <span className="text-2xl">{placingEmoji}</span>
            <span className="text-white font-bold text-sm">Кликни на карту, чтобы поставить</span>
            <button
              onClick={() => { setPlacingBuilding(null); setPlacingEmoji('') }}
              className="ml-2 text-white/60 hover:text-white text-lg"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Build Panel */}
      <AnimatePresence>
        {showBuildPanel && (
          <BuildPanel
            buildings={buildingList}
            coins={dashboard.coins}
            onClose={() => setShowBuildPanel(false)}
            onPlace={startPlacing}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
