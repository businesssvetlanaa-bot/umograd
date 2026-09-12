import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import timMascot from '../assets/tim-mascot.png'

function EyeIcon({ open }: { open: boolean }) {
  return open ? '🙈' : '👁️'
}

export default function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function validate(): string {
    if (!form.name.trim()) return 'Введите ваше имя'
    if (!form.email.trim()) return 'Введите email'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Введите корректный email'
    if (form.password.length < 8) return 'Пароль должен быть не менее 8 символов'
    if (form.password !== form.confirm) return 'Пароли не совпадают'
    return ''
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationError = validate()
    if (validationError) { setError(validationError); return }
    setError(''); setLoading(true)
    try {
      await register(form.name.trim(), form.email.trim(), form.password)
      navigate('/onboarding')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка сервера. Попробуйте позже')
    } finally { setLoading(false) }
  }

  const inputClass = 'w-full rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-3.5 text-base outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100'

  return (
    <main className="min-h-screen bg-[#eef3ff] lg:grid lg:grid-cols-[.9fr_1.1fr]">
      <section className="relative min-h-[270px] overflow-hidden bg-[linear-gradient(150deg,#172554,#312e81_55%,#0f766e)] px-6 py-6 text-white sm:min-h-[320px] sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-10">
        <div className="absolute -left-24 bottom-[-80px] h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
        <div className="absolute -right-20 top-[-90px] h-72 w-72 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <span className="absolute left-[12%] top-[28%] text-amber-300">✦</span>
        <span className="absolute right-[12%] top-[15%] text-cyan-200">✦</span>

        <Link to="/login" className="relative z-10 flex w-fit items-center gap-3 text-white">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-amber-300 text-2xl shadow-lg">🏰</span>
          <span>
            <span className="block text-2xl font-black">Умоград</span>
            <span className="block text-[10px] font-bold uppercase tracking-[.18em] text-cyan-100/80">город, который строят знания</span>
          </span>
        </Link>

        <div className="relative z-10 mt-7 max-w-[65%] lg:mt-auto lg:max-w-md">
          <p className="mb-2 text-xs font-black uppercase tracking-[.18em] text-amber-300">Для родителей</p>
          <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">Откройте ребёнку мир знаний</h1>
          <p className="mt-4 hidden text-base leading-relaxed text-indigo-100 sm:block">
            Создайте семейный аккаунт, добавьте героя ребёнка и наблюдайте за его учебными открытиями.
          </p>
        </div>

        <div className="absolute -bottom-24 right-[-18px] z-[5] w-44 sm:-bottom-32 sm:w-56 lg:-bottom-16 lg:right-[-7%] lg:w-[58%]">
          <img src={timMascot} alt="Тим приглашает в Умоград" className="w-full drop-shadow-[0_18px_30px_rgba(0,0,0,.28)]" style={{ maskImage: 'linear-gradient(to bottom, black 74%, transparent 99%)' }} />
        </div>

        <div className="relative z-10 mt-7 hidden flex-wrap gap-2 lg:flex">
          {['🛡️ Родитель управляет профилем', '🎓 Репетитор не решает за ребёнка', '🏆 Учёба превращается в игру'].map((item) => (
            <span key={item} className="rounded-full border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold backdrop-blur">{item}</span>
          ))}
        </div>
      </section>

      <section className="relative z-20 flex items-center justify-center px-4 pb-8 sm:px-8 lg:min-h-screen lg:p-10">
        <div className="-mt-5 w-full max-w-xl rounded-[28px] border border-white/80 bg-white/95 p-5 shadow-[0_24px_70px_rgba(49,46,129,.16)] backdrop-blur-xl sm:-mt-8 sm:p-8 lg:mt-0">
          <Link to="/login" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-500 transition hover:text-indigo-600">← Вернуться ко входу</Link>
          <p className="mb-1 text-xs font-black uppercase tracking-[.18em] text-indigo-500">Шаг 1 из 2</p>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Аккаунт родителя</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">Почта нужна только взрослому. У ребёнка будет отдельный герой и PIN-код.</p>

          <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-bold text-slate-700" htmlFor="register-name">Как к вам обращаться</label>
              <input id="register-name" type="text" autoComplete="name" placeholder="Например, Светлана" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-bold text-slate-700" htmlFor="register-email">Email</label>
              <input id="register-email" type="email" autoComplete="email" placeholder="example@mail.ru" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700" htmlFor="register-password">Пароль</label>
              <div className="relative">
                <input id="register-password" type={showPass ? 'text' : 'password'} autoComplete="new-password" placeholder="Минимум 8 символов" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={`${inputClass} pr-12`} />
                <button type="button" aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400">{<EyeIcon open={showPass} />}</button>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-bold text-slate-700" htmlFor="register-confirm">Повторите пароль</label>
              <div className="relative">
                <input id="register-confirm" type={showConfirm ? 'text' : 'password'} autoComplete="new-password" placeholder="Ещё раз" value={form.confirm} onChange={(e) => setForm((f) => ({ ...f, confirm: e.target.value }))} className={`${inputClass} pr-12`} />
                <button type="button" aria-label={showConfirm ? 'Скрыть пароль' : 'Показать пароль'} onClick={() => setShowConfirm((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400">{<EyeIcon open={showConfirm} />}</button>
              </div>
            </div>

            {error && <div className="sm:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600" role="alert">{error}</div>}

            <button type="submit" disabled={loading} className="sm:col-span-2 mt-1 min-h-13 rounded-2xl bg-[linear-gradient(135deg,#4f46e5,#4338ca)] px-6 py-3.5 text-base font-black text-white shadow-[0_10px_24px_rgba(79,70,229,.28)] transition hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60">
              {loading ? 'Создаём аккаунт…' : 'Продолжить: создать героя →'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-500">Уже есть аккаунт? <Link to="/login" className="font-extrabold text-indigo-600">Войти</Link></p>
          <p className="mt-4 border-t border-slate-100 pt-4 text-center text-xs leading-relaxed text-slate-400">Создавая аккаунт, вы подтверждаете, что являетесь родителем или законным представителем ребёнка.</p>
        </div>
      </section>
    </main>
  )
}
