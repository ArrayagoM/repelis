// ─────────────────────────────────────────────────────────────────────────
// Auth simple para el admin dashboard.
//
// Realidad técnica: en un SPA estático sin backend, NO existe auth "real".
// Cualquiera con DevTools puede ver el bundle y derivar el PIN.
// Lo que SÍ damos es protección contra el 99% que entra por casualidad o
// curiosidad. Para auth seria habría que mover esto a un edge function.
//
// El PIN se setea via env VITE_ADMIN_PIN. Si no está configurado, el
// dashboard queda abierto (modo desarrollo).
// ─────────────────────────────────────────────────────────────────────────

const SESSION_KEY = 'repelis:adminSession:v1'
const SESSION_TTL_MS = 8 * 60 * 60 * 1000   // 8 horas

const configuredPin = () => {
  try { return import.meta.env.VITE_ADMIN_PIN || '' } catch { return '' }
}

// Hash trivial (no es criptográficamente seguro — es a propósito, este sistema
// no pretende serlo. Solo evita que el PIN viaje en texto plano en localStorage).
const hash = (str) => {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i)
    h |= 0
  }
  return String(h)
}

export const adminConfigured = () => !!configuredPin()

export const adminLogin = (pin) => {
  if (!adminConfigured()) return true  // sin PIN configurado → libre
  if (!pin || hash(pin) !== hash(configuredPin())) return false
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      ts: Date.now(),
      h: hash(pin),
    }))
  } catch {}
  return true
}

export const adminIsAuthed = () => {
  if (!adminConfigured()) return true
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return false
    const { ts, h } = JSON.parse(raw)
    if (!ts || Date.now() - ts > SESSION_TTL_MS) return false
    return h === hash(configuredPin())
  } catch {
    return false
  }
}

export const adminLogout = () => {
  try { localStorage.removeItem(SESSION_KEY) } catch {}
}

// Flag de "admin tiene acceso a features premium aún cuando esté gateado"
// Útil para cuando agreguemos el modelo Premium voluntario.
export const adminHasPremium = () => adminIsAuthed()
