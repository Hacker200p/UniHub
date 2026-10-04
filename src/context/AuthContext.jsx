import { useEffect, useState } from 'react'
import { AuthContext } from './authContext.js'
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api'

async function authRequest(path, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Authentication failed')
  return payload.data
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('ush_session'))
      if (stored) {
        delete stored.refreshToken
      }
      return stored
    } catch {
      return null
    }
  })

  useEffect(() => {
    if (session) {
      const safe = { user: session.user, accessToken: session.accessToken }
      localStorage.setItem('ush_session', JSON.stringify(safe))
    } else {
      localStorage.removeItem('ush_session')
    }
  }, [session])

  const login = async (credentials) => {
    const next = await authRequest('/auth/login', credentials)
    const cleanSession = { user: next.user, accessToken: next.accessToken }
    setSession(cleanSession)
    return cleanSession
  }

  const register = async (details) => {
    const next = await authRequest('/auth/register', details)
    const cleanSession = { user: next.user, accessToken: next.accessToken }
    setSession(cleanSession)
    return cleanSession
  }

  const refreshSession = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) {
        setSession(null)
        throw new Error(payload.message || 'Session expired')
      }
      const next = { user: payload.data.user, accessToken: payload.data.accessToken }
      setSession(next)
      return next
    } catch (err) {
      setSession(null)
      throw err
    }
  }

  const updateProfile = async (details) => {
    const response = await fetch(`${API_URL}/user/profile`, {
      method: 'PATCH',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session?.accessToken}`,
      },
      body: JSON.stringify(details),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(payload.message || 'Profile update failed')
    const next = { ...session, user: payload.data.user }
    setSession(next)
    return next.user
  }

  const logout = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // best effort
    }
    setSession(null)
  }

  const logoutAll = async () => {
    try {
      if (session?.accessToken) {
        await fetch(`${API_URL}/auth/logout-all`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        })
      }
    } catch {
      // best effort
    }
    setSession(null)
  }

  const setAuthSession = (nextSession) => {
    const cleanSession = nextSession ? { user: nextSession.user, accessToken: nextSession.accessToken } : null
    setSession(cleanSession)
    return cleanSession
  }

  return (
    <AuthContext.Provider
      value={{
        ...session,
        isAuthenticated: Boolean(session?.accessToken),
        user: session?.user || null,
        accessToken: session?.accessToken || null,
        login,
        register,
        refreshSession,
        setAuthSession,
        updateProfile,
        logout,
        logoutAll,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
