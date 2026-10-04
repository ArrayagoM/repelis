// Intro de arranque (animación + sonido) estilo "app nativa".
// Se muestra una vez por sesión: al abrir la home, o en cualquier ruta si ya está instalada como app.
// Se omite con "reducir movimiento", en dispositivos de gama baja y para bots/buscadores.

const SEEN_KEY = 'repelis:intro:v1'
export const INTRO_TOTAL_MS = 3100
export const INTRO_SOUND_URL = '/sounds/intro.wav'

export const isBotUA = (ua = '') => /bot|crawl|spider|slurp|lighthouse|headless|prerender/i.test(String(ua))

export const prefersReducedMotion = () => {
  try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

export const introSeen = () => {
  try { return sessionStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

export const markIntroSeen = () => {
  try { sessionStorage.setItem(SEEN_KEY, '1') } catch { /* modo privado */ }
}

export const shouldPlayIntro = ({ pathname, standalone, reducedMotion, seen, bot, lowEnd }) =>
  !seen && !reducedMotion && !bot && !lowEnd && (standalone || pathname === '/')
