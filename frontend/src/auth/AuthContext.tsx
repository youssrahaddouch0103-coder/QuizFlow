import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '../api/api'
import { setUnauthorizedHandler, tokenStore } from '../api/client'
import type { Teacher } from '../api/types'
import { storePending, type PendingRegistration } from './pendingRegistration'

interface AuthState {
  teacher: Teacher | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, displayName: string) => Promise<PendingRegistration>
  verifyEmail: (challengeId: string, code: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    tokenStore.set(null)
    setTeacher(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStore.get()) {
      setLoading(false)
      return
    }
    api
      .me()
      .then(setTeacher)
      .catch(() => tokenStore.set(null))
      .finally(() => setLoading(false))
  }, [logout])

  const value = useMemo<AuthState>(
    () => ({
      teacher,
      loading,
      logout,
      login: async (email, password) => {
        const res = await api.login(email, password)
        tokenStore.set(res.token)
        setTeacher(res.teacher)
      },
      register: async (email, password, displayName) => {
        const res = await api.register(email, password, displayName)
        storePending(res)
        return res
      },
      verifyEmail: async (challengeId, code) => {
        const res = await api.verifyEmail(challengeId, code)
        tokenStore.set(res.token)
        setTeacher(res.teacher)
        storePending(null)
      },
    }),
    [teacher, loading, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>')
  return ctx
}
