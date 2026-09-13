import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../api/auth'
import type { ChildLoginProfile } from '../types/auth'
import timMascot from '../assets/tim-mascot.png'

type Tab = 'parent' | 'child'

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.099-3.56M6.228 6.228A9.97 9.97 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.97 9.97 0 01-4.342 5.311M6.228 6.228L3 3m3.228 3.228l3.65 3.65M17.772 17.772l3.228 3.228m-3.228-3.228l-3.65-3.65" />
    </svg>
  )
}

function AdventurePanel() {
  return (
    <section className="relative min-h-[320px] overflow-hidden bg-[linear-gradient(145deg,#172554_0%,#312e81_46%,#0f766e_100%)] px-6 pb-7 pt-6 text-white sm:min-h-[370px] sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-16">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <span className="absolute left-[9%] top-[18%] text-xl animate-pulse">✦</span>
        <span className="absolute left-[42%] top-[8%] text-sm text-cyan-200 animate-pulse">✦</span>
        <span className="absolute right-[12%] top-[13%] text-2xl text-amber-300 animate-pulse">✦</span>
        <span className="absolute bottom-[18%] left-[15%] text-sm text-amber-200 animate-pulse">✦</span>
        <div className="absolute -left-20 bottom-[-110px] h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -right-24 top-[-90px] h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
      </div>

      <div className="relative z-10 flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300 text-2xl shadow-[0_8px_30px_rgba(251,191,36,.35)]">🏰</div>
        <div>
          <div className="text-2xl font-black tracking-tight">Умоград</div>
          <div className="text-xs font-bold uppercase tracking-[.18em] text-cyan-100/80">город, который строят знания</div>
        </div>
      </div>

      <div className="relative z-10 mt-7 max-w-[58%] sm:max-w-[55%] lg:mt-14 lg:max-w-xl">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold backdrop-blur-md">
          <span>✨</span> Игровой репетитор для 4 класса
        </div>
        <h1 className="text-3xl font-black leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
          Учись. Исследуй. <span className="text-amber-300">Строй свой мир.</span>
        </h1>
        <p className="mt-4 hidden max-w-lg text-base leading-relaxed text-indigo-100 sm:block lg:text-lg">
          Тим объяснит сложное простыми словами, поможет найти решение и наградит за каждый новый шаг.
        </p>
      </div>

      <div className="absolute right-3 top-[126px] z-[5] h-32 w-28 overflow-hidden rounded-[28px] border border-white/20 bg-slate-950/25 shadow-2xl sm:-bottom-24 sm:right-0 sm:top-auto sm:h-auto sm:w-64 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:shadow-none lg:bottom-0 lg:right-[-2%] lg:w-[48%] xl:right-[2%] xl:w-[46%]">
        <div className="absolute inset-x-[15%] bottom-[7%] h-[72%] rounded-full bg-cyan-300/20 blur-3xl" />
        <img
          src={timMascot}
          alt="Тим — дружелюбный репетитор Умограда"
          className="relative h-full w-full object-cover object-[50%_8%] drop-shadow-[0_20px_35px_rgba(0,0,0,.3)] sm:h-auto sm:object-contain"
          style={{ maskImage: 'linear-gradient(to bottom, black 74%, transparent 99%)' }}
        />
      </div>

      <div className="relative z-10 mt-6 hidden w-fit items-center gap-2 rounded-2xl border border-white/15 bg-slate-950/25 px-4 py-3 text-sm font-bold shadow-xl backdrop-blur-md lg:flex">
        <span className="text-xl">👋</span>
        <span>Привет! Я Тим. Давай разберёмся вместе!</span>
      </div>

      <div className="relative z-10 mt-7 flex max-w-[62%] flex-wrap gap-2 lg:max-w-none">
        {['➗ Математика', '📖 Русский', '🔤 Английский'].map((subject) => (
          <span key={subject} className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white/90 backdrop-blur-md sm:text-xs">
            {subject}
          </span>
        ))}
      </div>
    </section>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, childLogin } = useAuth()
  const [tab, setTab] = useState<Tab>('parent')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [parentEmail, setParentEmail] = useState(() => localStorage.getItem('childLogin_parentEmail') ?? '')
  const [children, setChildren] = useState<ChildLoginProfile[]>([])
  const [childrenLoading, setChildrenLoading] = useState(false)
  const [selectedChild, setSelectedChild] = useState<ChildLoginProfile | null>(null)
  const [pin, setPin] = useState('')

  useEffect(() => { setError('') }, [tab])

  async function handleParentLogin(e: FormEvent) {
    e.preventDefault()
    if (!email || !password) { setError('Введите email и пароль'); return }
    setError(''); setLoading(true)
    try {
      await login(email, password)
      navigate('/parent/dashboard')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сервера. Попробуйте позже')
    } finally { setLoading(false) }
  }

  async function loadChildren(e: FormEvent) {
    e.preventDefault()
    if (!parentEmail) { setError('Введите email родителя'); return }
    setError(''); setChildrenLoading(true)
    try {
      const normalizedEmail = parentEmail.trim().toLocaleLowerCase('en-US')
      const data = await authApi.findChildProfiles(normalizedEmail)
      setChildren(data)
      if (data.length === 0) setError('Профили не найдены. Проверь email или попроси родителя помочь со входом.')
      else localStorage.setItem('childLogin_parentEmail', normalizedEmail)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Родитель не найден')
    } finally { setChildrenLoading(false) }
  }

  async function handleChildLogin() {
    if (!selectedChild) { setError('Выберите профиль'); return }
    if (!selectedChild.has_pin) { setError('Для этого героя самостоятельный вход пока выключен. Попроси родителя установить PIN-код.'); return }
    if (pin.length !== 4) { setError('Введи PIN-код из 4 цифр'); return }
    setError(''); setLoading(true)
    try {
      const data = await childLogin(selectedChild.id, pin)
      navigate(`/child/${data.child.id}/world`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка входа')
    } finally { setLoading(false) }
  }

  function switchTab(next: Tab) {
    setTab(next)
    setError('')
  }

  const inputClass = 'w-full rounded-2xl border-2 border-slate-200 bg-slate-50/70 px-4 py-3.5 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100'

  return (
    <main className="min-h-screen bg-[#eef3ff] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(430px,.92fr)]">
      <AdventurePanel />

      <section className="relative z-20 flex items-center justify-center px-4 pb-8 pt-0 sm:px-8 lg:min-h-screen lg:p-10">
        <div className="-mt-5 w-full max-w-lg rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(49,46,129,.16)] backdrop-blur-xl sm:-mt-8 sm:p-8 lg:mt-0">
          <div className="mb-6">
            <p className="mb-1 text-xs font-black uppercase tracking-[.18em] text-indigo-500">Добро пожаловать</p>
            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Войти в Умоград
            </h2>
            <p className="mt-2 text-sm text-slate-500">Выберите, кто сегодня отправляется за знаниями.</p>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5" role="tablist" aria-label="Выбор типа входа">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'parent'}
              onClick={() => switchTab('parent')}
              className={`min-w-0 rounded-xl px-2 py-3 text-xs font-extrabold transition sm:px-3 sm:text-sm ${tab === 'parent' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              👤 Родитель
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'child'}
              onClick={() => switchTab('child')}
              className={`min-w-0 rounded-xl px-2 py-3 text-xs font-extrabold transition sm:px-3 sm:text-sm ${tab === 'child' ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              🎮 Ребёнок
            </button>
          </div>

          {tab === 'parent' ? (
            <form onSubmit={handleParentLogin} className="flex flex-col gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700" htmlFor="parent-email">Email</label>
                <input id="parent-email" type="email" autoComplete="email" placeholder="example@mail.ru" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700" htmlFor="parent-password">Пароль</label>
                <div className="relative">
                  <input id="parent-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" placeholder="Ваш пароль" value={password} onChange={(e) => setPassword(e.target.value)} className={`${inputClass} pr-12`} />
                  <button type="button" aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600">
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </div>

              {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600" role="alert">{error}</div>}

              <button type="submit" disabled={loading} className="mt-1 min-h-13 rounded-2xl bg-[linear-gradient(135deg,#4f46e5,#4338ca)] px-6 py-3.5 text-base font-black text-white shadow-[0_10px_24px_rgba(79,70,229,.28)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(79,70,229,.32)] active:translate-y-0 disabled:opacity-60">
                {loading ? 'Открываем ворота…' : 'Войти в кабинет →'}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4">
              {children.length === 0 ? (
                <form onSubmit={loadChildren} className="flex flex-col gap-4">
                  <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm leading-relaxed text-teal-800">
                    Попроси взрослого помочь: введи email, на который зарегистрирован родитель.
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-bold text-slate-700" htmlFor="child-parent-email">Email родителя</label>
                    <input id="child-parent-email" type="email" autoComplete="email" placeholder="Email мамы или папы" value={parentEmail} onChange={(e) => setParentEmail(e.target.value)} className={inputClass} />
                  </div>
                  {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600" role="alert">{error}</div>}
                  <button type="submit" disabled={childrenLoading} className="min-h-13 rounded-2xl bg-[linear-gradient(135deg,#0d9488,#0f766e)] px-6 py-3.5 text-base font-black text-white shadow-[0_10px_24px_rgba(13,148,136,.24)] transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60">
                    {childrenLoading ? 'Ищем героя…' : 'Найти моего героя →'}
                  </button>
                </form>
              ) : (
                <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); void handleChildLogin() }}>
                  <p className="text-sm font-bold text-slate-700">Выбери своего героя:</p>
                  <div className="grid grid-cols-2 gap-3">
                    {children.map((child) => (
                      <button
                        key={child.id}
                        type="button"
                        onClick={() => { setSelectedChild(child); setPin(''); setError('') }}
                        className="rounded-2xl border-2 p-4 text-center transition hover:-translate-y-0.5"
                        style={{
                          background: child.has_pin ? '#ECFDF5' : '#F8FAFC',
                          borderColor: selectedChild?.id === child.id ? '#4F46E5' : 'transparent',
                          boxShadow: selectedChild?.id === child.id ? '0 0 0 3px rgba(79,70,229,.14)' : 'none',
                        }}
                      >
                        <div className="mb-1 text-4xl">🎮</div>
                        <div className="text-sm font-black text-slate-800">{child.name}</div>
                        <div className="text-xs font-semibold text-slate-500">{child.grade} класс · {child.has_pin ? 'PIN настроен' : 'вход выключен'}</div>
                      </button>
                    ))}
                  </div>

                  {selectedChild?.has_pin && (
                    <div>
                      <label className="mb-1.5 block text-sm font-bold text-slate-700" htmlFor="child-pin">PIN-код</label>
                      <input id="child-pin" type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={4} placeholder="4 цифры" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} className={`${inputClass} text-center text-xl tracking-[.45em]`} />
                    </div>
                  )}
                  {selectedChild && !selectedChild.has_pin && (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-relaxed text-amber-800">Самостоятельный вход для этого героя выключен. Попроси родителя открыть кабинет и установить PIN-код.</div>
                  )}

                  {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600" role="alert">{error}</div>}

                  <div className="grid grid-cols-[.8fr_1.2fr] gap-2">
                    <button type="button" onClick={() => { setChildren([]); setSelectedChild(null); setPin(''); setError('') }} className="min-h-13 rounded-2xl border-2 border-slate-200 font-bold text-slate-600 transition hover:bg-slate-50">← Назад</button>
                    <button type="submit" disabled={!selectedChild?.has_pin || pin.length !== 4 || loading} className="min-h-13 rounded-2xl bg-[linear-gradient(135deg,#0d9488,#0f766e)] px-4 font-black text-white shadow-[0_10px_24px_rgba(13,148,136,.24)] transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
                      {loading ? 'Входим…' : 'Войти по PIN →'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Впервые в Умограде?{' '}
            <Link to="/register" className="font-extrabold text-indigo-600 transition hover:text-indigo-800">Создать аккаунт</Link>
          </p>

          <div className="mt-5 flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
            <span>🛡️</span><span>Безопасное пространство для учёбы</span>
          </div>
        </div>
      </section>
    </main>
  )
}
