// ─────────────────────────────────────────────────────────────────────────
// Formato de la biblioteca + fusión entre dispositivos. PURO (sin React ni DOM):
// lo usan el navegador (library.js) y el servidor (api/) para que ambos acuerden
// qué es una biblioteca válida y cómo se combinan dos copias.
//
// Borrados: cada borrado deja una "tumba" { 'list:movie:1': timestamp }. Al fusionar,
// un ítem desaparece si hay una tumba MÁS NUEVA que él; así lo que borrás en un celu
// no reaparece desde otro. Volver a agregarlo (con fecha posterior) lo recupera.
// ─────────────────────────────────────────────────────────────────────────

export const LIST_MAX = 200
export const HISTORY_MAX = 60
export const REMINDERS_MAX = 100
export const DAYS_MAX = 400
export const DAILY_DAYS = 14
export const SEEN_MAX = 3000
export const TOMBS_MAX = 500
export const TOMB_TTL_MS = 90 * 86400000
export const ACH_MAX = 50

export const emptyLibrary = () => ({
  v: 1,
  list: [],
  history: [],
  reminders: [],
  days: [],            // días con actividad: 'YYYY-MM-DD' (hora local)
  daily: {},           // { 'YYYY-MM-DD': ['tv:1:s1e2', 'movie:2'] } últimos días (maratonista)
  seen: {},            // { 'movie:1': 1 } títulos distintos vistos alguna vez
  genres: {},          // { '28': 3 } cuántos títulos vistos por género
  minutes: 0,          // minutos totales reproducidos
  achSeen: [],         // logros ya mostrados
  tombs: {},           // borrados: { 'list:movie:1': ts }
})

// ─── Sanitizado (también protege al servidor de datos basura) ───────────
const num = (v, fallback = 0) => { const n = Number(v); return Number.isFinite(n) ? n : fallback }
const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : null)
const isType = (t) => t === 'movie' || t === 'tv'
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const SEEN_RE = /^(movie|tv):\d+$/
const arr = (v) => (Array.isArray(v) ? v : [])
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {})

const optNum = (key, v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)) ? { [key]: Math.round(Number(v) * 10) / 10 } : {})

const baseItem = (x) => {
  if (!x || !isType(x.type)) return null
  const id = Math.trunc(num(x.id, NaN))
  if (!Number.isFinite(id) || id <= 0) return null
  return {
    id,
    type: x.type,
    title: str(x.title) || 'Sin título',
    poster: str(x.poster, 100),
    backdrop: str(x.backdrop, 100),
    date: str(x.date, 10),
    genres: arr(x.genres).map((g) => Math.trunc(num(g, NaN))).filter(Number.isFinite).slice(0, 10),
    ...(x.totalSeasons ? { totalSeasons: Math.max(1, Math.trunc(num(x.totalSeasons, 1))) } : {}),
    ...optNum('rating', x.rating),     // puntaje de TMDB: decide si para reproducirlo hace falta cuenta (lib/access.js)
    ...optNum('votes', x.votes),
    ...optNum('pop', x.pop),
  }
}

const cleanListItem = (x) => { const b = baseItem(x); return b && { ...b, addedAt: num(x.addedAt) } }
const cleanReminder = (x) => {
  const b = baseItem(x)
  return b && { ...b, addedAt: num(x.addedAt), notified: !!x.notified, ...(x.notifiedSoon ? { notifiedSoon: true } : {}) }
}
const cleanHistory = (x) => {
  const b = baseItem(x)
  if (!b) return null
  return {
    ...b,
    ...(b.type === 'tv' ? { season: Math.max(1, Math.trunc(num(x.season, 1))), episode: Math.max(1, Math.trunc(num(x.episode, 1))) } : {}),
    runtimeMin: Math.max(0, num(x.runtimeMin)),
    watchedSec: Math.max(0, num(x.watchedSec)),
    finished: !!x.finished,
    ...(x.dismissed ? { dismissed: true } : {}),
    updatedAt: num(x.updatedAt),
  }
}

const dedupe = (items, keyFn) => {
  const seen = new Set()
  return items.filter((i) => { const k = keyFn(i); if (seen.has(k)) return false; seen.add(k); return true })
}
const itemKey = (x) => `${x.type}:${x.id}`

/** Devuelve SIEMPRE una biblioteca válida, con límites de tamaño. Nunca lanza. */
export const normalizeLibrary = (raw) => {
  const r = obj(raw)
  const days = [...new Set(arr(r.days).filter((d) => typeof d === 'string' && DAY_RE.test(d)))].sort().slice(-DAYS_MAX)

  const dailyKeys = Object.keys(obj(r.daily)).filter((d) => DAY_RE.test(d)).sort().slice(-DAILY_DAYS)
  const daily = Object.fromEntries(dailyKeys.map((d) => [d, arr(r.daily[d]).filter((s) => typeof s === 'string').map((s) => s.slice(0, 40)).slice(0, 50)]))

  const seenKeys = Object.keys(obj(r.seen)).filter((k) => SEEN_RE.test(k)).slice(0, SEEN_MAX)
  const genreKeys = Object.keys(obj(r.genres)).filter((k) => /^\d{1,6}$/.test(k)).slice(0, 100)
  const tombKeys = Object.keys(obj(r.tombs)).filter((k) => k.length <= 60 && Number.isFinite(num(r.tombs[k], NaN))).slice(0, TOMBS_MAX)

  return {
    v: 1,
    list: dedupe(arr(r.list).map(cleanListItem).filter(Boolean), itemKey).slice(0, LIST_MAX),
    history: dedupe(arr(r.history).map(cleanHistory).filter(Boolean), itemKey).slice(0, HISTORY_MAX),
    reminders: dedupe(arr(r.reminders).map(cleanReminder).filter(Boolean), itemKey).slice(0, REMINDERS_MAX),
    days,
    daily,
    seen: Object.fromEntries(seenKeys.map((k) => [k, 1])),
    genres: Object.fromEntries(genreKeys.map((k) => [k, Math.max(0, Math.trunc(num(r.genres[k])))])),
    minutes: Math.min(10_000_000, Math.max(0, num(r.minutes))),
    achSeen: [...new Set(arr(r.achSeen).filter((a) => typeof a === 'string').map((a) => a.slice(0, 40)))].slice(0, ACH_MAX),
    tombs: Object.fromEntries(tombKeys.map((k) => [k, num(r.tombs[k])])),
  }
}

// ─── Fusión ─────────────────────────────────────────────────────────────
const mergeItems = ({ prefix, a, b, tombs, tsOf, pick, max }) => {
  const map = new Map()
  for (const it of [...a, ...b]) {
    const k = itemKey(it)
    const prev = map.get(k)
    map.set(k, prev ? pick(prev, it) : it)
  }
  return [...map.values()]
    .filter((it) => !((tombs[`${prefix}:${itemKey(it)}`] || 0) > tsOf(it)))
    .sort((x, y) => tsOf(y) - tsOf(x))
    .slice(0, max)
}

const unionObj = (a, b) => ({ ...a, ...b })
const maxObj = (a, b) => {
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] || 0, v)
  return out
}

/**
 * Combina dos bibliotecas (local y remota). Conmutativa e idempotente:
 * merge(a, b) ≡ merge(b, a) y merge(m, m) ≡ m.
 */
export const mergeLibraries = (localRaw, remoteRaw, { now = Date.now() } = {}) => {
  const a = normalizeLibrary(localRaw)
  const b = normalizeLibrary(remoteRaw)

  // Tumbas: la más nueva gana. Se aplican TODAS a los ítems y recién después se podan las viejas
  // del resultado (una tumba de más de 90 días ya no hace falta guardarla).
  const tombs = maxObj(a.tombs, b.tombs)
  const tombEntries = Object.entries(tombs)
    .filter(([, ts]) => now - ts < TOMB_TTL_MS)
    .sort((x, y) => y[1] - x[1])
    .slice(0, TOMBS_MAX)

  const list = mergeItems({
    prefix: 'list', a: a.list, b: b.list, tombs, tsOf: (x) => x.addedAt, max: LIST_MAX,
    pick: (x, y) => (x.addedAt <= y.addedAt ? x : y),          // conserva la fecha original
  })
  const history = mergeItems({
    prefix: 'hist', a: a.history, b: b.history, tombs, tsOf: (x) => x.updatedAt, max: HISTORY_MAX,
    pick: (x, y) => (x.updatedAt >= y.updatedAt ? x : y),      // lo último que viste gana
  })
  const reminders = mergeItems({
    prefix: 'rem', a: a.reminders, b: b.reminders, tombs, tsOf: (x) => x.addedAt, max: REMINDERS_MAX,
    pick: (x, y) => {
      const win = x.addedAt >= y.addedAt ? x : y
      const notified = x.notified || y.notified
      const notifiedSoon = x.notifiedSoon || y.notifiedSoon
      return { ...win, notified, ...(notifiedSoon ? { notifiedSoon: true } : {}) }
    },
  })

  const days = [...new Set([...a.days, ...b.days])].sort().slice(-DAYS_MAX)
  const dailyDays = [...new Set([...Object.keys(a.daily), ...Object.keys(b.daily)])].sort().slice(-DAILY_DAYS)
  const daily = Object.fromEntries(dailyDays.map((d) => [d, [...new Set([...(a.daily[d] || []), ...(b.daily[d] || [])])].slice(0, 50)]))

  return {
    v: 1,
    list,
    history,
    reminders,
    days,
    daily,
    seen: unionObj(a.seen, b.seen),
    genres: maxObj(a.genres, b.genres),
    // No se pueden sumar los minutos de dos copias (se contaría doble lo ya sincronizado): nos quedamos con el mayor
    minutes: Math.max(a.minutes, b.minutes),
    achSeen: [...new Set([...a.achSeen, ...b.achSeen])].slice(0, ACH_MAX),
    tombs: Object.fromEntries(tombEntries),
  }
}

/** Para saber si hay algo que sincronizar / si una copia está vacía. */
export const isLibraryEmpty = (lib) => {
  const l = normalizeLibrary(lib)
  return !l.list.length && !l.history.length && !l.reminders.length && !l.days.length && !Object.keys(l.seen).length
}

/** Firma estable para detectar cambios (evita bucles de sincronización). */
export const libraryFingerprint = (lib) => {
  const l = normalizeLibrary(lib)
  const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([x], [y]) => x.localeCompare(y)))
  return JSON.stringify({ ...l, seen: sortObj(l.seen), genres: sortObj(l.genres), tombs: sortObj(l.tombs), daily: sortObj(l.daily) })
}
