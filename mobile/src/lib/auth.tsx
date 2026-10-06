import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { SITE_URL } from '@/lib/site'
import type { AuthStatus } from '@/lib/access'

// Cuentas de Life High en la app. La sesión es una cookie HttpOnly que el sistema (Android/iOS) guarda solo.
// Ingreso con Google: por ahora solo en la web (necesita credenciales nativas); acá, mail y contraseña.

export interface AppUser {
  id: string
  email: string
  name: string
  emailVerified: boolean
  root?: boolean
}

export const ERROR_MESSAGES: Record<string, string> = {
  network: 'No pudimos conectarnos. Revisá tu internet e intentá de nuevo.',
  auth_unavailable: 'Las cuentas todavía no están disponibles. Probá más tarde.',
  email_invalid: 'Ese mail no parece válido.',
  email_taken: 'Ya existe una cuenta con ese mail. Probá ingresar.',
  password_short: 'La contraseña tiene que tener al menos 8 caracteres.',
  password_long: 'La contraseña es demasiado larga.',
  password_weak: 'Esa contraseña es muy fácil de adivinar. Elegí otra.',
  password_invalid: 'Escribí una contraseña.',
  invalid_credentials: 'Mail o contraseña incorrectos.',
  no_password: 'Tu cuenta entra con Google y no tiene contraseña. Ingresá desde la web.',
  too_many_requests: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
  not_authenticated: 'Tu sesión venció. Ingresá de nuevo.',
  server_error: 'Algo falló de nuestro lado. Probá de nuevo en un rato.',
}
export const errorMessage = (code: string) => ERROR_MESSAGES[code] ?? ERROR_MESSAGES.server_error

interface Result { ok: boolean; status: number; data: any; error: string | null }

const TIMEOUT_MS = 12000

export const apiCall = async (action: string, method: 'GET' | 'POST' = 'GET', body?: unknown): Promise<Result> => {
  const ctl = new AbortController()
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`${SITE_URL}/api/auth/${action}`, {
      method,
      credentials: 'include',
      signal: ctl.signal,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    let data: any = {}
    try { data = await res.json() } catch { /* sin cuerpo */ }
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : data?.error || 'server_error' }
  } catch {
    return { ok: false, status: 0, data: {}, error: 'network' }
  } finally {
    clearTimeout(t)
  }
}

interface Ctx {
  status: AuthStatus
  user: AppUser | null
  login: (email: string, password: string) => Promise<string | null>
  register: (email: string, password: string, name: string) => Promise<string | null>
  logout: () => Promise<void>
}

const AuthContext = createContext<Ctx>({
  status: 'loading', user: null, login: async () => null, register: async () => null, logout: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [user, setUser] = useState<AppUser | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const st = await apiCall('status')
      if (cancelled) return
      if (st.ok && st.data?.enabled === false) { setStatus('unavailable'); return }
      const me = await apiCall('me')
      if (cancelled) return
      if (me.ok) { setUser(me.data.user); setStatus('in') }
      else if (me.status === 401) setStatus('out')
      else setStatus('unavailable')          // sin conexión o servicio caído: no dejamos a nadie afuera por eso
    })()
    return () => { cancelled = true }
  }, [])

  const enter = useCallback(async (action: 'login' | 'register', payload: Record<string, string>) => {
    const r = await apiCall(action, 'POST', payload)
    if (!r.ok) return errorMessage(r.error ?? 'server_error')
    setUser(r.data.user)
    setStatus('in')
    return null
  }, [])

  const value = useMemo<Ctx>(() => ({
    status, user,
    login: (email, password) => enter('login', { email: email.trim(), password }),
    register: (email, password, name) => enter('register', { email: email.trim(), password, name: name.trim() }),
    logout: async () => {
      await apiCall('logout', 'POST', {})
      setUser(null)
      setStatus('out')
    },
  }), [status, user, enter])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
