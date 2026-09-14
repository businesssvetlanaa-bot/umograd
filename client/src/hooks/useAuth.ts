import { useState, useEffect, useCallback } from 'react'
import { authApi } from '../api/auth'
import type { User, Child } from '../types/auth'

interface AuthState {
  token: string | null
  role: 'parent' | 'child' | null
  user: User | null
  child: Child | null
  loading: boolean
}

// Читаем localStorage при каждом вызове хука — не при загрузке модуля.
// Это важно: каждый компонент получает актуальное состояние после логина.
function readStorage(): AuthState {
  const token = localStorage.getItem('token')

  return {
    token,
    role: token ? (localStorage.getItem('role') as 'parent' | 'child' | null) : null,
    user: null,
    child: null,
    loading: Boolean(token),
  }
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(readStorage)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      return
    }
    authApi
      .me()
      .then((data) => {
        setState((s) => ({
          ...s,
          role: data.role,
          user: data.user ?? null,
          child: data.child ?? null,
          loading: false,
        }))
      })
      .catch(() => {
        localStorage.removeItem('token')
        localStorage.removeItem('parentToken')
        localStorage.removeItem('role')
        setState({ token: null, role: null, user: null, child: null, loading: false })
      })
  }, [])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await authApi.register({ name, email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('parentToken', data.token)
    localStorage.setItem('role', 'parent')
    setState({ token: data.token, role: 'parent', user: data.user, child: null, loading: false })
    return data
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password })
    localStorage.setItem('token', data.token)
    localStorage.setItem('parentToken', data.token)
    localStorage.setItem('role', 'parent')
    setState({ token: data.token, role: 'parent', user: data.user, child: null, loading: false })
    return data
  }, [])

  const childLogin = useCallback(async (child_id: string, pin: string) => {
    if (localStorage.getItem('role') === 'parent') {
      const currentToken = localStorage.getItem('token')
      if (currentToken) localStorage.setItem('parentToken', currentToken)
    }
    const data = await authApi.childLogin({ child_id, pin })
    localStorage.setItem('token', data.token)
    localStorage.setItem('role', 'child')
    setState({ token: data.token, role: 'child', user: null, child: data.child, loading: false })
    return data
  }, [])

  const exitChild = useCallback(async () => {
    const parentToken = localStorage.getItem('parentToken')
    if (!parentToken) {
      localStorage.removeItem('token')
      localStorage.removeItem('role')
      setState({ token: null, role: null, user: null, child: null, loading: false })
      return false
    }

    localStorage.setItem('token', parentToken)
    localStorage.setItem('role', 'parent')
    try {
      const data = await authApi.me()
      setState({ token: parentToken, role: 'parent', user: data.user ?? null, child: null, loading: false })
      return true
    } catch {
      localStorage.removeItem('token')
      localStorage.removeItem('parentToken')
      localStorage.removeItem('role')
      setState({ token: null, role: null, user: null, child: null, loading: false })
      return false
    }
  }, [])

  const replaceParentToken = useCallback((token: string) => {
    localStorage.setItem('token', token)
    localStorage.setItem('parentToken', token)
    localStorage.setItem('role', 'parent')
    setState((current) => ({ ...current, token, role: 'parent', child: null }))
  }, [])
  const logout = useCallback(() => {
    localStorage.removeItem('token')
    localStorage.removeItem('parentToken')
    localStorage.removeItem('role')
    setState({ token: null, role: null, user: null, child: null, loading: false })
  }, [])

  return { ...state, register, login, childLogin, exitChild, replaceParentToken, logout }
}
