/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { API_BASE, apiPost, setAccessToken, setLogoutHandler } from "../lib/api"
import { setCurrentUser } from "../lib/auth"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const hasInitialized = useRef(false)

  const clearSession = useCallback(() => {
    setUser(null)
    setAccessToken(null)
    setCurrentUser(null)
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiPost(`${API_BASE}/api/v1/auth/logout/`)
    } catch (err) {
      console.error("Logout failed:", err)
    } finally {
      clearSession()
      navigate("/")
    }
  }, [clearSession, navigate])

  useEffect(() => {
    setLogoutHandler(() => {
      clearSession()
      navigate("/")
    })
  }, [clearSession, navigate])

  useEffect(() => {
    if (hasInitialized.current) {
      return
    }

    hasInitialized.current = true

    async function init() {
      try {
        const refreshRes = await fetch(`${API_BASE}/api/v1/auth/token/refresh/`, {
          method: "POST",
          credentials: "include",
        })

        if (!refreshRes.ok) {
          return
        }

        const refreshData = await refreshRes.json()
        setAccessToken(refreshData.access)

        const userRes = await fetch(`${API_BASE}/api/v1/auth/me/`, {
          headers: { Authorization: `Bearer ${refreshData.access}` },
          credentials: "include",
        })

        if (!userRes.ok) {
          await logout()
          return
        }

        const userData = await userRes.json()
        setUser(userData)
        setCurrentUser(userData)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [logout])

  const login = useCallback(async (username, password) => {
    const res = await fetch(`${API_BASE}/api/v1/auth/login/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
      credentials: "include",
    })
    if (!res.ok) {
      let msg = "Invalid credentials"
      try {
        const data = await res.json()
        if (data.detail) msg = data.detail
        else if (data.error) msg = data.error
      } catch (err) {
        console.error("Unable to parse login error:", err)
      }
      throw new Error(msg)
    }
    const data = await res.json()
    setAccessToken(data.access)
    setUser(data.user)
    setCurrentUser(data.user)
    return data
  }, [])

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
