import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { childrenApi } from '../api/children'
import timMascot from '../assets/tim-mascot.png'

const AVATARS = [
  { type: 'explorer', name: 'Искатель', emoji: '🧭', hint: 'любит открывать новое' },
  { type: 'witch', name: 'Волшебница', emoji: '🔮', hint: 'находит магию в знаниях' },
  { type: 'builder', name: 'Строитель', emoji: '🔨', hint: 'создаёт удивительные миры' },
  { type: 'ranger', name: 'Следопыт', emoji: '🗺️', hint: 'не боится сложных дорог' },
]

const COLORS = [
  { id: 'blue', label: 'Синий', bg: '#DBEAFE', dot: '#3B82F6' },
  { id: 'green', label: 'Зелёный', bg: '#DCFCE7', dot: '#22C55E' },
  { id: 'orange', label: 'Оранжевый', bg: '#FFEDD5', dot: '#F97316' },
  { id: 'purple', label: 'Фиолетовый', bg: '#EDE9FE', dot: '#8B5CF6' },
]

const GRADES = [4, 5, 6, 7, 8, 9]

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [grade, setGrade] = useState(4)
  const [avatarType, setAvatarType] = useState('explorer')
  const [avatarColor, setAvatarColor] = useState('blue')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const selectedAvatar = AVATARS.find((avatar) => avatar.type === avatarType) ?? AVATARS[0]
  const selectedColor = COLORS.find((color) => color.id === avatarColor) ?? COLORS[0]
  const pinIsValid = pin.length === 0 || pin.length === 4
  const canSubmit = name.trim().length >= 2 && pinIsValid

  async function handleCreate() {
    if (!canSubmit) return
    setError(''); setLoading(true)
    try {
      await childrenApi.create({ name: name.trim(), grade, avatar_type: avatarType, avatar_color: avatarColor, pin: pin || undefined })
      navigate('/parent/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сервера. Попробуйте позже')
    } finally { setLoading(false) }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_0%,#dbeafe_0,transparent_28%),radial-gradient(circle_at_90%_15%,#ccfbf1_0,transparent_25%),#f5f7ff] px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300 text-2xl shadow-md">🏰</span>
            <div><div className="text-xl font-black text-slate-900">Умоград</div><div className="text-xs font-bold text-indigo-500">Создание нового героя</div></div>
          </div>
          <button onClick={() => navigate('/parent/dashboard')} className="rounded-xl px-3 py-2 text-sm font-bold text-slate-500 transition hover:bg-white">Пропустить</button>
        </header>

        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="rounded-[28px] border border-white bg-white/95 p-5 shadow-[0_20px_60px_rgba(49,46,129,.12)] sm:p-6">
            <p className="text-xs font-black uppercase tracking-[.18em] text-indigo-500">Шаг 2 из 2</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Создайте героя ребёнка</h1>
            <p className="mt-2 text-sm text-slate-500">Можно указать только имя или игровой псевдоним — полные данные не нужны.</p>

            <div className="mt-5 grid gap-4 sm:gap-5">
              <div>
                <label className="mb-2 block text-sm font-extrabold text-slate-700" htmlFor="hero-name">Имя героя</label>
                <input id="hero-name" type="text" maxLength={30} placeholder="Например: Маша или СуперКот" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between"><span className="text-sm font-extrabold text-slate-700">Класс</span><span className="text-xs font-bold text-teal-600">Сейчас доступен 4-й</span></div>
                <div className="flex flex-wrap gap-2">
                  {GRADES.map((item) => (
                    <button key={item} type="button" disabled={item !== 4} onClick={() => setGrade(item)} className={`rounded-xl px-4 py-2.5 text-sm font-extrabold ${grade === item ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-100 text-slate-400'} disabled:cursor-not-allowed`}>
                      {item} класс{item !== 4 && <span className="ml-1 text-[10px]">скоро</span>}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-extrabold text-slate-700">Кем будет герой?</span>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {AVATARS.map((avatar) => (
                    <motion.button key={avatar.type} type="button" whileTap={{ scale: .97 }} onClick={() => setAvatarType(avatar.type)} className={`rounded-2xl border-2 p-3 text-center transition ${avatarType === avatar.type ? 'border-indigo-500 bg-indigo-50 shadow-sm' : 'border-slate-100 bg-slate-50 hover:border-indigo-200'}`}>
                      <span className="block text-3xl">{avatar.emoji}</span><span className="mt-1 block text-xs font-black text-slate-700">{avatar.name}</span>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div>
                <span className="mb-2 block text-sm font-extrabold text-slate-700">Любимый цвет</span>
                <div className="flex gap-3">
                  {COLORS.map((color) => (
                    <button key={color.id} type="button" aria-label={color.label} onClick={() => setAvatarColor(color.id)} className="grid h-11 w-11 place-items-center rounded-full transition hover:scale-105" style={{ background: color.bg, boxShadow: avatarColor === color.id ? `0 0 0 3px white, 0 0 0 6px ${color.dot}` : 'none' }}>
                      <span className="h-6 w-6 rounded-full" style={{ background: color.dot }} />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-extrabold text-slate-700" htmlFor="hero-pin">PIN-код для входа ребёнка (по желанию)</label>
                <input id="hero-pin" type="password" inputMode="numeric" maxLength={4} placeholder="4 цифры" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 px-4 py-3.5 text-center text-xl tracking-[.5em] outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100" />
                <p className="mt-1.5 text-xs text-slate-400">Если зададите PIN, ребёнок сможет входить в свой профиль самостоятельно.</p>
              </div>

              {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600" role="alert">{error}</div>}

              <div className="mt-1 rounded-[22px] border border-indigo-100 bg-indigo-50/60 p-2 shadow-[0_10px_24px_rgba(49,46,129,.12)]">
                <button onClick={handleCreate} disabled={!canSubmit || loading} className="min-h-14 w-full rounded-2xl bg-[linear-gradient(135deg,#4f46e5,#0d9488)] px-6 text-lg font-black text-white shadow-[0_12px_28px_rgba(79,70,229,.25)] transition hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40">
                  {loading ? 'Создаём героя…' : 'Создать героя и войти в Умоград →'}
                </button>
                {!pinIsValid && <p className="px-2 pb-1 pt-2 text-center text-xs font-semibold text-amber-700">Введите все 4 цифры или оставьте поле пустым</p>}
              </div>
            </div>
          </section>

          <aside className="relative min-h-[300px] overflow-hidden rounded-[28px] bg-[linear-gradient(155deg,#312e81,#0f766e)] p-6 text-white shadow-[0_20px_60px_rgba(49,46,129,.16)] lg:min-h-full">
            <span className="absolute right-7 top-7 text-amber-300">✦</span>
            <div className="relative z-10 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm font-extrabold">Привет! Я Тим 👋</p>
              <p className="mt-1 text-sm leading-relaxed text-indigo-100">Вместе мы разберёмся в теме, потренируемся и найдём путь к ответу!</p>
            </div>
            <div className="relative z-10 mt-5 rounded-2xl bg-white/95 p-4 text-slate-800 shadow-xl">
              <div className="flex items-center gap-3"><span className="grid h-14 w-14 place-items-center rounded-2xl text-3xl" style={{ background: selectedColor.bg }}>{selectedAvatar.emoji}</span><div><p className="font-black">{name.trim() || 'Твой герой'}</p><p className="text-xs text-slate-500">{selectedAvatar.hint}</p></div></div>
              <div className="mt-4 flex items-center gap-2 text-xs font-bold text-slate-500"><span className="rounded-lg bg-amber-100 px-2 py-1 text-amber-700">⭐ 0 опыта</span><span className="rounded-lg bg-yellow-100 px-2 py-1 text-yellow-700">🪙 50 монет</span></div>
            </div>
            <img src={timMascot} alt="Тим" className="absolute -bottom-28 left-1/2 w-64 -translate-x-1/2 drop-shadow-2xl lg:-bottom-20 lg:w-72" style={{ maskImage: 'linear-gradient(to bottom, black 72%, transparent 99%)' }} />
          </aside>
        </div>
      </div>
    </main>
  )
}
