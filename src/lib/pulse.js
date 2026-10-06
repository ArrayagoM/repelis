// ─────────────────────────────────────────────────────────────────────────
// "Latido" anónimo de estadísticas: cuántos hay conectados, qué miran y por cuánto tiempo.
//
//  · El id de visitante es aleatorio y CAMBIA CADA DÍA (no sirve para seguir a nadie entre días).
//  · No se manda mail, IP ni nombre. De la cuenta solo viaja "es miembro: sí/no".
//  · El tiempo de visualización lo calcula el servidor entre latidos; acá solo avisamos qué se mira.
//  · No se cuenta el tráfico del fundador (root) para no ensuciar los números.
// ─────────────────────────────────────────────────────────────────────────

const SID_KEY = 'lifehigh:sid:v1'
const GATE_KEY = 'lifehigh:gateAt:v1'
const GATE_WINDOW_MS = 15 * 60_000

export const randomId = () => {
  const bytes = new Uint8Array(18)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const localDay = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

let memorySid = null
/** Id de visitante de HOY (se renueva cada día). */
export const getSid = (now = new Date()) => {
  const today = localDay(now)
  try {
    const saved = JSON.parse(localStorage.getItem(SID_KEY) || 'null')
    if (saved?.day === today && typeof saved.id === 'string') return saved.id
    const id = randomId()
    localStorage.setItem(SID_KEY, JSON.stringify({ day: today, id }))
    return id
  } catch {
    return (memorySid ||= randomId())      // sin localStorage: un id por carga de página
  }
}

/** Agrupa la ruta en una categoría (nunca se manda la URL completa). */
export const pageGroup = (pathname = '/') => {
  const p = String(pathname).split(/[?#]/)[0] || '/'
  if (p === '/') return 'home'
  if (p.startsWith('/admin') || p.startsWith('/panel')) return null          // el panel no se mide
  if (p.startsWith('/movie/')) return 'movie'
  if (p.startsWith('/tv/')) return 'tv'
  if (p === '/search') return 'search'
  if (p === '/mi-lista') return 'mi-lista'
  if (p.startsWith('/cuenta')) return 'cuenta'
  if (p === '/calendario') return 'calendario'
  if (p === '/cines-cerca') return 'cines'
  if (['/descargar', '/apk', '/tv'].includes(p)) return 'descargar'
  if (['/about', '/terms', '/privacy', '/dmca'].includes(p)) return 'legal'
  if (p.startsWith('/comunidad') || p.startsWith('/lista') || p.startsWith('/u/') || p === '/perfil') return 'comunidad'
  return 'catalog'                                                             // populares, géneros, series, anime…
}

export const detectPlatform = () => {
  try {
    const ua = navigator.userAgent || ''
    if (/Electron/i.test(ua)) return 'desktop-app'
    if (window.Capacitor?.isNativePlatform?.()) return /iphone|ipad/i.test(ua) ? 'ios-app' : 'android-app'
    if (/smart-?tv|tizen|webos|android tv|crkey|aft[a-z]/i.test(ua)) return 'tv'
    if (window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone) return 'pwa'
  } catch { /* entorno raro */ }
  return 'web'
}

let enabled = false
export const setPulseEnabled = (value) => { enabled = !!value }
export const isPulseEnabled = () => enabled

const post = (payload) => {
  try {
    return fetch('/api/pulse', {
      method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
  } catch { return Promise.resolve(null) }
}

/** Manda un latido. Devuelve false si el servidor pidió dejar de medir (estadísticas apagadas). */
export const sendHeartbeat = async ({ page, nav = false, watching = null, member = false }) => {
  if (!enabled || !page) return true
  const res = await post({
    k: 'hb', sid: getSid(), page, nav, member, plat: detectPlatform(),
    ...(watching ? { w: { key: watching.key, title: watching.title } } : {}),
  }).catch(() => null)
  if (res && (res.status === 204 || res.status === 503 || res.status === 404)) return false
  return true
}

/** Evento puntual (embudo de registro, donaciones). Sin efecto si las estadísticas están apagadas. */
export const pulseEvent = (name) => {
  if (!enabled) return
  post({ k: 'ev', sid: getSid(), name }).catch(() => {})
}

// ─── Para atribuir un registro a la pared "necesitás cuenta" ───────────
export const markGateShown = () => { try { sessionStorage.setItem(GATE_KEY, String(Date.now())) } catch { /* sin storage */ } }
export const gateShownRecently = (now = Date.now()) => {
  try { return now - Number(sessionStorage.getItem(GATE_KEY) || 0) <= GATE_WINDOW_MS } catch { return false }
}
