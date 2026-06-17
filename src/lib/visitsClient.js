// Cliente para el endpoint /api/visits (admin only)
// El PIN admin ya está guardado en localStorage por adminAuth.

const SESSION_KEY = 'repelis:adminSession:v1'

const getPinHash = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw).h : null
  } catch { return null }
}

/**
 * Fetcha visitas reales del backend. Si no hay sesión admin → null.
 * Si KV no está configurado todavía → devuelve estructura vacía con flag.
 */
export const fetchVisits = async (pin) => {
  if (!pin) return null
  try {
    const res = await fetch('/api/visits', {
      headers: { 'x-admin-pin': pin },
    })
    if (res.status === 401) return { unauthorized: true }
    if (!res.ok) return { error: `HTTP ${res.status}` }
    return await res.json()
  } catch (e) {
    return { error: String(e?.message || e) }
  }
}

export { getPinHash }
