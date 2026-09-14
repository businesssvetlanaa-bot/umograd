import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import RegisterPage from './pages/RegisterPage'
import LoginPage from './pages/LoginPage'
import OnboardingPage from './pages/OnboardingPage'
import ParentDashboard from './pages/ParentDashboard'
import ChildWorld from './pages/ChildWorld'
import TutorPage from './pages/TutorPage'
import SessionPage from './pages/SessionPage'
import ParentChildPage from './pages/ParentChildPage'
import ParentSettingsPage from './pages/ParentSettingsPage'

function RequireParent({ children }: { children: React.ReactNode }) {
  const { token, role, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>
  if (!token || role !== 'parent') return <Navigate to="/login" replace />
  return <>{children}</>
}

function RequireChild({ children }: { children: React.ReactNode }) {
  const { token, role, loading } = useAuth()
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Загрузка...</div>
  if (!token || role !== 'child') return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route path="/onboarding" element={
        <RequireParent><OnboardingPage /></RequireParent>
      } />
      <Route path="/parent/dashboard" element={
        <RequireParent><ParentDashboard /></RequireParent>
      } />
      <Route path="/parent/settings" element={
        <RequireParent><ParentSettingsPage /></RequireParent>
      } />
      <Route path="/parent/children/:id" element={
        <RequireParent><ParentChildPage /></RequireParent>
      } />

      <Route path="/child/:id/world" element={
        <RequireChild><ChildWorld /></RequireChild>
      } />
      <Route path="/child/:id/tutor" element={
        <RequireChild><TutorPage /></RequireChild>
      } />
      <Route path="/child/:id/session/:session_id" element={
        <RequireChild><SessionPage /></RequireChild>
      } />
    </Routes>
  )
}
