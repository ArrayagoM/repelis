// Instalación "en un toque" para gente común.
//   Android (Chrome)  → diálogo nativo de instalación (beforeinstallprompt) si el navegador lo ofrece.
//   iPhone / iPad     → guía de 3 pasos para "Agregar a pantalla de inicio" (Apple no deja instalar apps sin App Store).
//   El resto           → página /descargar.
import { detectPlatform } from './downloads'

const DISMISS_KEY = 'repelis:installDismissed:v1'
const INSTALLED_KEY = 'repelis:installed:v1'
const DISMISS_DAYS = 7
export const IOS_GUIDE_EVENT = 'lifehigh:ios-guide'

// ── Navegadores embebidos (Instagram, Facebook, TikTok…): ahí iOS NO ofrece "Agregar a inicio" ──
export const inAppBrowserName = (ua = '') => {
  const s = String(ua)
  if (/Instagram/i.test(s)) return 'Instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(s)) return 'Facebook'
  if (/musical_ly|BytedanceWebview|TikTok/i.test(s)) return 'TikTok'
  if (/Snapchat/i.test(s)) return 'Snapchat'
  if (/Twitter/i.test(s)) return 'X'
  if (/\bLine\//i.test(s)) return 'LINE'
  if (/MicroMessenger/i.test(s)) return 'WeChat'
  if (/GSA\//i.test(s)) return 'Google'
  return null
}

// En iOS, "Agregar a inicio" existe en Safari y en Chrome/Edge/Firefox recientes.
export const iosBrowser = (ua = '') => {
  const s = String(ua)
  if (/CriOS/i.test(s)) return 'chrome'
  if (/FxiOS/i.test(s)) return 'firefox'
  if (/EdgiOS/i.test(s)) return 'edge'
  return /Safari/i.test(s) ? 'safari' : 'other'
}

export const isStandalone = () => {
  if (typeof window === 'undefined') return false
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true
    if (window.navigator.standalone === true) return true
    if (window.Capacitor?.isNativePlatform?.()) return true
  } catch { /* sin acceso a matchMedia */ }
  const ua = window.navigator.userAgent || ''
  return /Electron|; wv\)/i.test(ua)
}

// ── Descarte (recordado 7 días) ──
const safeGet = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const safeSet = (k, v) => { try { localStorage.setItem(k, v) } catch { /* modo privado */ } }

export const wasInstalled = () => safeGet(INSTALLED_KEY) === '1'
export const dismissedRecently = (now = Date.now()) => {
  const ts = Number(safeGet(DISMISS_KEY))
  return !!ts && now - ts < DISMISS_DAYS * 86400000
}
export const dismissInstallBanner = () => safeSet(DISMISS_KEY, String(Date.now()))

/** ¿Corresponde mostrar el aviso flotante? Solo celulares/tablets que todavía no tienen la app. */
export const shouldShowBanner = ({ platform, standalone, installed, dismissed }) =>
  (platform === 'android' || platform === 'ios') && !standalone && !installed && !dismissed

// ── Instalación nativa (Android/Chrome) ──
let deferredPrompt = null
const listeners = new Set()
const notify = () => listeners.forEach((fn) => fn())

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    safeSet(INSTALLED_KEY, '1')
    notify()
  })
}

export const subscribeInstall = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const canPromptNative = () => !!deferredPrompt

// ?plataforma=ios|android|windows|mac|linux|tv|smarttv fuerza las instrucciones de esa plataforma (útil para mandarle el link a alguien).
const OVERRIDES = ['android', 'ios', 'windows', 'mac', 'linux', 'tv', 'smarttv']

export const currentPlatform = () => {
  if (typeof navigator === 'undefined') return 'other'
  try {
    const forced = new URLSearchParams(window.location.search).get('plataforma')
    if (OVERRIDES.includes(forced)) return forced
  } catch { /* sin location */ }
  return detectPlatform(navigator.userAgent, navigator.maxTouchPoints)
}

/**
 * Intenta instalar la app. Devuelve:
 *   'accepted' | 'dismissed'  → se mostró el diálogo nativo
 *   'ios-guide'               → se abrió la guía de 3 pasos (iPhone/iPad)
 *   'unavailable'             → no hay instalación directa: usar la descarga clásica
 */
export const requestInstall = async () => {
  if (currentPlatform() === 'ios') {
    window.dispatchEvent(new CustomEvent(IOS_GUIDE_EVENT))
    return 'ios-guide'
  }
  if (deferredPrompt) {
    const evt = deferredPrompt
    deferredPrompt = null
    notify()
    evt.prompt()
    const { outcome } = await evt.userChoice
    if (outcome === 'accepted') safeSet(INSTALLED_KEY, '1')
    return outcome === 'accepted' ? 'accepted' : 'dismissed'
  }
  return 'unavailable'
}
