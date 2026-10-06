// ─────────────────────────────────────────────────────────────────────────
// Cuenta de usuario (OPCIONAL) + sincronización de la biblioteca entre dispositivos.
//
//  · Sin cuenta todo sigue funcionando igual, guardado en el dispositivo.
//  · Con cuenta, Mi lista / Continuar viendo / avisos / logros se sincronizan:
//    cada cambio se sube (con un respiro de unos segundos) y al volver a la app se baja lo nuevo.
//  · La sesión vive en una cookie HttpOnly: el JavaScript de la página nunca ve el token.
// ─────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react'
import { getLibrary, replaceLibrary, subscribe as subscribeLibrary } from './library'
import { mergeLibraries, libraryFingerprint, emptyLibrary } from './libraryMerge'
import { getDonations, adoptSupporterSince } from './donations'
import { showToast } from './toast'
import { canUsePersonal } from './access'

const API = '/api/auth'
const DEBOUNCE_MS = 4000          // espera tras un cambio antes de subir
const MIN_INTERVAL_MS = 60_000    // como mucho una subida por minuto (mientras mirás algo se guarda cada 10 s)
const POLL_MS = 5 * 60_000        // trae cambios de otros dispositivos cada 5 min con la app abierta

// status: 'loading' | 'out' | 'in' | 'unavailable'
let state = { status: 'loading', user: null, mail: false, googleClientId: null, syncing: false, lastSyncAt: 0, syncError: false }
const listeners = new Set()
const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((fn) => fn()) }

export const getAuth = () => state
export const subscribeAuth = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const useAuth = () => useSyncExternalStore(subscribeAuth, getAuth, getAuth)

/** ¿Este usuario puede usar Mi lista / Continuar viendo y demás funciones con cuenta? */
export const usePersonal = () => canUsePersonal(useAuth().status)

/** Espera (máx. 3 s) a que se sepa si hay sesión, para no tratar como invitado a quien recién abrió la app. */
export const whenAuthSettled = (timeoutMs = 3000) => new Promise((resolve) => {
  if (state.status !== 'loading') return resolve(state.status)
  const done = () => { off(); clearTimeout(t); resolve(state.status === 'loading' ? 'unavailable' : state.status) }
  const off = subscribeAuth(() => { if (state.status !== 'loading') done() })
  const t = setTimeout(done, timeoutMs)
  return undefined
})

/** Para tests. */
export const __resetAuth = () => {
  state = { status: 'loading', user: null, mail: false, googleClientId: null, syncing: false, lastSyncAt: 0, syncError: false }
  lastFp = ''; started = false; clearTimeout(timer)
}

// ─── HTTP ───────────────────────────────────────────────────────────────
const request = async (path, { method = 'GET', body, keepalive = false } = {}) => {
  try {
    const res = await fetch(`${API}/${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      keepalive,
    })
    let data = {}
    try { data = await res.json() } catch { /* respuesta sin cuerpo */ }
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: 'network' } }
  }
}

/** Texto en español para cada código de error de la API. */
export const ERROR_MESSAGES = {
  network: 'No pudimos conectarnos. Revisá tu internet e intentá de nuevo.',
  auth_unavailable: 'Las cuentas todavía no están disponibles. Probá más tarde.',
  email_invalid: 'Ese mail no parece válido.',
  email_taken: 'Ya existe una cuenta con ese mail. Probá ingresar.',
  password_short: 'La contraseña tiene que tener al menos 8 caracteres.',
  password_long: 'La contraseña es demasiado larga.',
  password_weak: 'Esa contraseña es muy fácil de adivinar. Elegí otra.',
  password_invalid: 'Escribí una contraseña.',
  invalid_credentials: 'Mail o contraseña incorrectos.',
  google_invalid: 'No pudimos verificar tu cuenta de Google. Probá de nuevo.',
  google_unavailable: 'El ingreso con Google no está disponible por ahora. Usá tu mail y contraseña.',
  no_password: 'Tu cuenta entra con Google y no tiene contraseña.',
  too_many_requests: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.',
  token_invalid: 'Este enlace ya no sirve (venció o ya se usó). Pedí uno nuevo.',
  not_authenticated: 'Tu sesión venció. Ingresá de nuevo.',
  mail_unavailable: 'El envío de mails no está disponible por ahora.',
  library_too_large: 'Tu biblioteca es demasiado grande para sincronizar.',
  forbidden: 'No se pudo completar la acción. Recargá la página.',
  server_error: 'Algo falló de nuestro lado. Probá de nuevo en un rato.',
}
export const errorMessage = (code) => ERROR_MESSAGES[code] || ERROR_MESSAGES.server_error

// ─── Sincronización ─────────────────────────────────────────────────────
let lastFp = ''            // firma de la última biblioteca sincronizada
let timer = null
let started = false
let syncPromise = null

const applyMerged = (serverLibrary) => {
  // Fusionamos con lo ACTUAL (puede haber cambiado mientras viajaba el pedido); la fusión es idempotente
  const merged = mergeLibraries(getLibrary(), serverLibrary)
  if (libraryFingerprint(merged) !== libraryFingerprint(getLibrary())) replaceLibrary(merged)
}

/** Sube lo local, baja lo remoto y deja ambos iguales. Seguro de llamar muchas veces. */
export const syncNow = ({ keepalive = false } = {}) => {
  if (state.status !== 'in') return Promise.resolve(false)
  if (syncPromise) return syncPromise
  clearTimeout(timer)
  set({ syncing: true })
  syncPromise = (async () => {
    const supporterSince = getDonations().supporterSince || undefined
    const res = await request('sync', { method: 'POST', body: { library: getLibrary(), supporterSince }, keepalive })
    if (res.ok) {
      applyMerged(res.data.library)
      if (res.data.supporterSince) adoptSupporterSince(res.data.supporterSince)
      lastFp = libraryFingerprint(getLibrary())
      set({ syncing: false, lastSyncAt: Date.now(), syncError: false })
      return true
    }
    if (res.status === 401) {
      set({ syncing: false, status: 'out', user: null })
      showToast({ icon: '🔒', title: 'Tu sesión venció', text: 'Ingresá de nuevo para seguir sincronizando.', actionLabel: 'Ingresar', to: '/cuenta', ttl: 9000 })
    } else {
      set({ syncing: false, syncError: true })
    }
    return false
  })().finally(() => { syncPromise = null })
  return syncPromise
}

const scheduleSync = () => {
  if (state.status !== 'in') return
  if (libraryFingerprint(getLibrary()) === lastFp) return
  clearTimeout(timer)
  const wait = Math.max(DEBOUNCE_MS, state.lastSyncAt + MIN_INTERVAL_MS - Date.now())
  timer = setTimeout(() => syncNow(), wait)
}

const startSyncing = () => {
  if (started || typeof window === 'undefined') return
  started = true
  subscribeLibrary(scheduleSync)
  document.addEventListener('visibilitychange', () => {
    if (state.status !== 'in') return
    if (document.hidden) { if (libraryFingerprint(getLibrary()) !== lastFp) syncNow({ keepalive: true }) }
    else syncNow()                                  // al volver: trae lo de otros dispositivos
  })
  window.addEventListener('online', () => syncNow())
  setInterval(() => { if (!document.hidden) syncNow() }, POLL_MS)
}

// ─── Acciones ───────────────────────────────────────────────────────────
const enter = async (data) => {
  set({ status: 'in', user: data.user, syncError: false })
  startSyncing()
  // Lo del dispositivo + lo de la cuenta, juntos; y lo subimos ya
  applyMerged(data.library)
  if (data.user?.supporterSince) adoptSupporterSince(data.user.supporterSince)
  lastFp = ''
  await syncNow()
}

/** Se llama una vez al abrir la app: ¿hay cuentas? ¿ya tenía sesión? */
export const initAuth = async () => {
  const status = await request('status')
  if (!status.ok || !status.data.enabled) { set({ status: 'unavailable' }); return }
  set({ mail: !!status.data.mail, googleClientId: status.data.googleClientId || null })
  const me = await request('me')
  if (me.ok) await enter(me.data)
  else set({ status: 'out', user: null })
}

export const register = async ({ email, password, name }) => {
  const res = await request('register', {
    method: 'POST',
    body: { email, password, name, library: getLibrary(), supporterSince: getDonations().supporterSince || undefined },
  })
  if (!res.ok) return { ok: false, error: res.data.error || 'server_error' }
  await enter(res.data)
  return { ok: true, mailSent: !!res.data.mailSent }
}

/** Ingreso / registro con Google: `credential` es el ID token que entrega el botón de Google. */
export const loginWithGoogle = async (credential) => {
  const res = await request('google', {
    method: 'POST',
    body: { credential, library: getLibrary(), supporterSince: getDonations().supporterSince || undefined },
  })
  if (!res.ok) return { ok: false, error: res.data.error || 'server_error' }
  await enter(res.data)
  return { ok: true, created: !!res.data.created }
}

export const login = async ({ email, password }) => {
  const res = await request('login', { method: 'POST', body: { email, password } })
  if (!res.ok) return { ok: false, error: res.data.error || 'server_error' }
  await enter(res.data)
  return { ok: true }
}

/** Cierra sesión. La biblioteca se borra de ESTE dispositivo (sigue guardada en la cuenta): así nadie más la ve en un equipo compartido. */
export const logout = async () => {
  await syncNow()                                   // última subida, para no perder nada
  clearTimeout(timer)
  await request('logout', { method: 'POST', body: {} })
  set({ status: 'out', user: null })
  lastFp = ''
  replaceLibrary(emptyLibrary())
}

export const forgotPassword = async (email) => {
  const res = await request('forgot', { method: 'POST', body: { email } })
  return res.ok ? { ok: true } : { ok: false, error: res.data.error || 'server_error' }
}

export const resetPassword = async ({ token, password }) => {
  const res = await request('reset', { method: 'POST', body: { token, password } })
  return res.ok ? { ok: true } : { ok: false, error: res.data.error || 'server_error' }
}

export const verifyEmail = async (token) => {
  const res = await request('verify', { method: 'POST', body: { token } })
  if (res.ok && state.user) set({ user: { ...state.user, emailVerified: true } })
  return res.ok ? { ok: true } : { ok: false, error: res.data.error || 'server_error' }
}

export const resendVerification = async () => {
  const res = await request('resend-verification', { method: 'POST', body: {} })
  return res.ok ? { ok: true, alreadyVerified: !!res.data.alreadyVerified } : { ok: false, error: res.data.error || 'server_error' }
}

export const changePassword = async ({ current, next }) => {
  const res = await request('password', { method: 'POST', body: { current, next } })
  return res.ok ? { ok: true } : { ok: false, error: res.data.error || 'server_error' }
}

/** Borra la cuenta y sus datos del servidor. Lo local del dispositivo se conserva. */
export const deleteAccount = async (proof) => {
  // proof: la contraseña (texto) o { credential } de Google para cuentas sin contraseña
  const body = typeof proof === 'string' ? { password: proof } : { password: proof?.password, credential: proof?.credential }
  const res = await request('delete', { method: 'POST', body })
  if (!res.ok) return { ok: false, error: res.data.error || 'server_error' }
  set({ status: 'out', user: null })
  lastFp = ''
  return { ok: true }
}
