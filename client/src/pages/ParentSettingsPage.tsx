import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuth } from '../hooks/useAuth'

const DELETE_ACCOUNT_PHRASE = 'УДАЛИТЬ АККАУНТ'

export default function ParentSettingsPage() {
  const navigate = useNavigate()
  const { replaceParentToken, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [deletePassword, setDeletePassword] = useState('')
  const [deletePhrase, setDeletePhrase] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function submitPassword(event: FormEvent) {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')
    const passwordBytes = new TextEncoder().encode(newPassword).length
    if (passwordBytes < 8 || passwordBytes > 72) {
      setPasswordError('Новый пароль должен содержать от 8 до 72 байт')
      return
    }
    if (newPassword !== newPasswordConfirmation) {
      setPasswordError('Новые пароли не совпадают')
      return
    }
    if (currentPassword === newPassword) {
      setPasswordError('Новый пароль должен отличаться от текущего')
      return
    }

    setPasswordBusy(true)
    try {
      const result = await authApi.changePassword({ current_password: currentPassword, new_password: newPassword })
      replaceParentToken(result.token)
      setCurrentPassword('')
      setNewPassword('')
      setNewPasswordConfirmation('')
      setPasswordSuccess('Пароль изменён. Другие сессии завершены.')
    } catch (error: unknown) {
      setPasswordError(error instanceof Error ? error.message : 'Не удалось изменить пароль')
    } finally {
      setPasswordBusy(false)
    }
  }

  async function submitAccountDeletion(event: FormEvent) {
    event.preventDefault()
    if (deleteBusy || deletePhrase !== DELETE_ACCOUNT_PHRASE) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await authApi.deleteAccount({ current_password: deletePassword, confirmation: deletePhrase })
      logout()
      navigate('/login', { replace: true })
    } catch (error: unknown) {
      setDeleteError(error instanceof Error ? error.message : 'Не удалось удалить аккаунт')
      setDeleteBusy(false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-gray-100 bg-white px-4 py-4 sm:px-6">
        <button type="button" onClick={() => navigate('/parent/dashboard')} aria-label="Вернуться в кабинет" className="text-lg font-bold text-gray-400 transition hover:text-gray-700">←</button>
        <h1 className="font-bold text-gray-800">Настройки аккаунта</h1>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 sm:py-8">
        <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-gray-900">Сменить пароль</h2>
          <p className="mt-1 text-sm text-gray-500">После смены пароля на других устройствах потребуется войти заново.</p>
          <form onSubmit={submitPassword} className="mt-5 space-y-4">
            <PasswordField label="Текущий пароль" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            <PasswordField label="Новый пароль" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            <PasswordField label="Повторите новый пароль" value={newPasswordConfirmation} onChange={setNewPasswordConfirmation} autoComplete="new-password" />
            {passwordError && <p role="alert" className="text-sm font-semibold text-red-600">{passwordError}</p>}
            {passwordSuccess && <p role="status" className="text-sm font-semibold text-emerald-600">{passwordSuccess}</p>}
            <button disabled={passwordBusy || !currentPassword || !newPassword || !newPasswordConfirmation} className="min-h-11 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50">
              {passwordBusy ? 'Сохраняем…' : 'Сменить пароль'}
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-red-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-red-700">Удалить аккаунт</h2>
          <p className="mt-2 text-sm text-gray-600">Будут безвозвратно удалены все профили детей, занятия, прогресс и награды.</p>
          <form onSubmit={submitAccountDeletion} className="mt-5 space-y-4">
            <PasswordField label="Текущий пароль" value={deletePassword} onChange={setDeletePassword} autoComplete="current-password" />
            <label className="block text-sm font-semibold text-gray-700">
              Введите <span className="select-all font-mono text-red-700">{DELETE_ACCOUNT_PHRASE}</span>
              <input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} autoComplete="off" className="mt-2 min-h-11 w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 outline-none transition focus:border-red-500 focus:bg-white" />
            </label>
            {deleteError && <p role="alert" className="text-sm font-semibold text-red-600">{deleteError}</p>}
            <button disabled={deleteBusy || !deletePassword || deletePhrase !== DELETE_ACCOUNT_PHRASE} className="min-h-11 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50">
              {deleteBusy ? 'Удаляем…' : 'Удалить аккаунт навсегда'}
            </button>
          </form>
        </section>
      </main>
    </div>
  )
}

function PasswordField({ label, value, onChange, autoComplete }: { label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  return (
    <label className="block text-sm font-semibold text-gray-700">
      {label}
      <input type="password" value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} className="mt-2 min-h-11 w-full rounded-xl border-2 border-gray-200 bg-gray-50 px-4 outline-none transition focus:border-indigo-500 focus:bg-white" />
    </label>
  )
}
