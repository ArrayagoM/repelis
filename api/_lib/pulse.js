// ─────────────────────────────────────────────────────────────────────────
// Recepción de "latidos" de la app: quién está conectado, qué está mirando y cuánto tiempo.
//
// Cada pestaña abierta manda un latido cada 1–2 min con un id aleatorio que CAMBIA CADA DÍA
// (no es un identificador persistente). El servidor calcula los segundos viendo como la diferencia
// entre dos latidos consecutivos del MISMO título (con tope), así no hay que confiar en lo que
// declara el navegador. Todo es anónimo y agregado: no se guarda IP, mail ni historial personal.
//
// Es analítica "indicativa": cualquiera podría mandar latidos falsos (no hay forma de evitarlo sin
// pedir cuenta), por eso hay validación estricta y límites.
// ─────────────────────────────────────────────────────────────────────────
import { parseUA } from './ua.js'

// Todo el panel se calcula en hora de Argentina (UTC-3, sin horario de verano)
export const TZ_OFFSET_MIN = -180
export const dayKey = (ms) => new Date(ms + TZ_OFFSET_MIN * 60000).toISOString().slice(0, 10)
export const hourKey = (ms) => String(new Date(ms + TZ_OFFSET_MIN * 60000).getUTCHours()).padStart(2, '0')

export const ONLINE_WINDOW_MS = 150_000      // "en línea" = latido en los últimos 150 s (mirando late cada 60 s, navegando cada 120 s)
const MIN_GAP_MS = 8_000                     // latidos más seguidos que esto se ignoran en los contadores
const MAX_DT_MS = 150_000                    // tope de tiempo que cuenta un latido (si hubo un corte, no se inventan minutos)

const SID_RE = /^[A-Za-z0-9_-]{16,40}$/
const KEY_RE = /^(movie|tv):\d{1,9}$/
const COUNTRY_RE = /^[A-Z]{2}$/
export const PLATFORMS = new Set(['web', 'pwa', 'android-app', 'ios-app', 'desktop-app', 'tv'])
export const PAGES = new Set(['home', 'movie', 'tv', 'search', 'catalog', 'mi-lista', 'cuenta', 'calendario', 'cines', 'descargar', 'legal', 'other'])
export const EVENTS = new Set(['gate_shown_watch', 'gate_shown_list', 'signup', 'signup_gate', 'login', 'donate_shown', 'donate_click'])

// Robots y herramientas automáticas (buscadores, vistas previas de links, monitores, scripts): no son personas
export const BOT_RE = /bot|crawl|spider|slurp|headless|lighthouse|pagespeed|facebookexternalhit|embedly|preview|monitor|uptime|pingdom|curl|wget|python-requests|httpclient|go-http|axios|node-fetch|okhttp|java\//i
export const isBot = (ua) => !ua || BOT_RE.test(ua)

const cleanText = (s, max) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max)

const decodeSafe = (s) => { try { return decodeURIComponent(s) } catch { return s } }

/** @returns {(req: { body: any, headers: Record<string,string> }) => Promise<{ status: number, body: object }>} */
export const createPulse = ({ stats, now = Date.now }) => async ({ body, headers = {} }) => {
  const bad = () => ({ status: 400, body: { error: 'bad_request' } })
  const ok = () => ({ status: 200, body: { ok: true } })
  if (!body || typeof body !== 'object') return bad()

  const sid = body.sid
  if (typeof sid !== 'string' || !SID_RE.test(sid)) return bad()
  if (isBot(headers['user-agent'])) return ok()           // no se cuentan robots (Vercel Analytics tampoco)
  const t = now()
  const day = dayKey(t)

  // ── Eventos puntuales (embudo, donaciones…) ──
  if (body.k === 'ev') {
    if (!EVENTS.has(body.name)) return bad()
    await stats.incDaily(day, { [`ev.${body.name}`]: 1 })
    return ok()
  }

  if (body.k !== 'hb') return bad()

  // ── Latido ──
  const h = (name) => headers[name] || ''
  const country = COUNTRY_RE.test(h('x-vercel-ip-country')) ? h('x-vercel-ip-country') : 'XX'
  const city = cleanText(decodeSafe(h('x-vercel-ip-city')), 40) || null
  const { device } = parseUA(h('user-agent'))
  const plat = PLATFORMS.has(body.plat) ? body.plat : 'web'
  const page = PAGES.has(body.page) ? body.page : 'other'
  const member = body.member === true
  const w = body.w && typeof body.w === 'object' ? body.w : null
  const watching = !!(w && KEY_RE.test(w.key))
  const key = watching ? w.key : null
  const type = watching ? w.key.split(':')[0] : null
  const title = watching ? cleanText(w.title, 120) || w.key : null

  const before = await stats.touchPresence(sid, {
    lastSeen: t, day, state: watching ? 'watch' : 'browse', wkey: key, wtitle: title,
    country, city, device, plat, member, page,
  })
  if (before && t - before.lastSeen < MIN_GAP_MS) return ok()    // demasiado seguido: no suma

  const continuous = !!before && before.day === day && t - before.lastSeen <= MAX_DT_MS
  const dt = continuous ? Math.min(t - before.lastSeen, MAX_DT_MS) / 1000 : 0
  const newToday = !before || before.day !== day

  const inc = { [`hours.${hourKey(t)}`]: 1 }
  if (newToday) {
    inc.visitors = 1
    inc[`byCountry.${country}`] = 1
    inc[`byDevice.${device}`] = 1
    inc[`byPlat.${plat}`] = 1
    inc[member ? 'members' : 'guests'] = 1
  }
  if (newToday || body.nav === true) {
    inc.views = 1
    inc[`pages.${page}`] = 1
  }
  if (dt > 0) inc.activeSeconds = dt

  if (watching) {
    const sameTitle = continuous && before.state === 'watch' && before.wkey === key
    const titleInc = {}
    if (sameTitle) {
      inc.watchSeconds = dt
      inc[member ? 'watch.member' : 'watch.guest'] = dt
      titleInc.seconds = dt
    } else {
      inc.plays = 1                  // empezó a ver este título (o volvió tras un corte)
      titleInc.plays = 1
    }
    await stats.incTitle(day, key, { title, type }, titleInc)
  }

  await stats.incDaily(day, inc)
  return ok()
}
