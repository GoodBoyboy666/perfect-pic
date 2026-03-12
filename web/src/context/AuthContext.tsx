import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { fetchClient } from '../lib/api'

export interface User {
  id: number
  username: string
  admin: boolean
  avatar?: string
  storage_quota: number | null
  storage_used: number
  status: number
  email: string
  email_verified: boolean
}

export interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (data: any) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseNumber(value: unknown): number | null {
  if (typeof value === 'number' && !Number.isNaN(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

function parseUser(payload: unknown): User | null {
  const candidate =
    isRecord(payload) && isRecord(payload.data) && isRecord(payload.data.user)
      ? payload.data.user
      : isRecord(payload) && isRecord(payload.user)
        ? payload.user
        : isRecord(payload) && isRecord(payload.data)
          ? payload.data
          : payload

  if (!isRecord(candidate)) return null

  const id = parseNumber(candidate.id)
  const username =
    typeof candidate.username === 'string' ? candidate.username.trim() : ''

  if (id === null || username === '') return null

  const adminRaw = candidate.admin ?? candidate.is_admin ?? candidate.isAdmin
  const admin = typeof adminRaw === 'boolean' ? adminRaw : false

  const storageUsedRaw = candidate.storage_used ?? candidate.storageUsed
  const storageUsed = parseNumber(storageUsedRaw) ?? 0

  const storageQuotaRaw = candidate.storage_quota ?? candidate.storageQuota
  const storageQuota =
    storageQuotaRaw === null || storageQuotaRaw === undefined
      ? null
      : parseNumber(storageQuotaRaw)

  const status = parseNumber(candidate.status) ?? 1

  const email = typeof candidate.email === 'string' ? candidate.email : ''
  const emailVerifiedRaw = candidate.email_verified ?? candidate.emailVerified
  const email_verified =
    typeof emailVerifiedRaw === 'boolean' ? emailVerifiedRaw : false
  const avatar =
    typeof candidate.avatar === 'string' ? candidate.avatar : undefined

  return {
    id,
    username,
    admin,
    avatar,
    storage_quota: storageQuota,
    storage_used: storageUsed,
    status,
    email,
    email_verified,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetchClient('/api/user/profile')
      const parsedUser = parseUser(res)
      setUser(parsedUser)
    } catch (error) {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const login = useCallback(
    async (formData: any) => {
      const res: any = await fetchClient('/api/login', {
        method: 'POST',
        body: formData,
      })
      if (res && res.token) {
        localStorage.setItem('token', res.token)
      }
      await refreshUser()
    },
    [refreshUser],
  )

  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    refreshUser()
  }, [refreshUser])

  const value = useMemo(
    () => ({ user, isLoading, login, logout, refreshUser }),
    [user, isLoading, login, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
