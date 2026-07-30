// Cliente para el endpoint /api/visits (admin only)
// El PIN se envía como header x-admin-pin y el backend lo compara con ADMIN_PIN.

const SESSION_KEY = 'repelis:adminSession:v1'
// Guardamos el último PIN que SÍ funcionó contra el backend, para no re-pedirlo.
const BACKEND_PIN_KEY = 'repelis:backendPin:v1'

const getPinHash = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw).h : null
  } catch { return null }
}

export const getSavedBackendPin = () => {
  try { return sessionStorage.getItem(BACKEND_PIN_KEY) || null } catch { return null }
}
export const saveBackendPin = (pin) => {
  try { sessionStorage.setItem(BACKEND_PIN_KEY, pin) } catch {}
}

/**
 * Fetcha visitas reales del backend.
 * Devuelve SIEMPRE un objeto con estado explícito para que la UI pueda
 * mostrar exactamente qué pasó (nunca falla en silencio):
 *   { ok, cities, stats, kvConfigured }        → éxito
 *   { unauthorized: true, status: 401 }        → PIN incorrecto / no coincide
 *   { noPin: true }                            → no hay PIN para enviar
 *   { error: '...' , status }                  → otro error
 */
export const fetchVisits = async (pin) => {
  if (!pin) return { noPin: true }
  try {
    const res = await fetch('/api/visits', {
      headers: { 'x-admin-pin': pin },
      cache: 'no-store',
    })
    if (res.status === 401) return { unauthorized: true, status: 401 }
    if (!res.ok) return { error: `HTTP ${res.status}`, status: res.status }
    const data = await res.json()
    // Si llegó acá con ok, el PIN funcionó → lo recordamos
    if (data?.ok) saveBackendPin(pin)
    return data
  } catch (e) {
    return { error: String(e?.message || e) }
  }
}

export { getPinHash }
