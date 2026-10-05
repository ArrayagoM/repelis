// ─────────────────────────────────────────────────────────────────────────
// Biblioteca personal del usuario (sin cuenta, 100% en el dispositivo):
//   · list       → "Mi lista"
//   · history    → "Continuar viendo" (progreso estimado)
//   · reminders  → "Avisame cuando salga"
//   · days/stats → rachas y logros
//
// IMPORTANTE: los reproductores son iframes de terceros, no podemos leer el
// minuto exacto del video. El progreso es una ESTIMACIÓN por tiempo reproducido.
// ─────────────────────────────────────────────────────────────────────────
import { useSyncExternalStore } from 'react'

const KEY = 'lifehigh:library:v1'
const LIST_MAX = 200
const HISTORY_MAX = 60
const REMINDERS_MAX = 100
const DAYS_MAX = 400
// Una vez visto este % de la duración, lo damos por terminado
export const FINISHED_RATIO = 0.9

const empty = () => ({
  v: 1,
  list: [],
  history: [],
  reminders: [],
  days: [],            // días con actividad: 'YYYY-MM-DD' (hora local)
  daily: {},           // { 'YYYY-MM-DD': ['tv:1', 'movie:2'] } últimos días (maratonista)
  seen: {},            // { 'movie:1': 1 } títulos distintos vistos alguna vez
  genres: {},          // { '28': 3 } cuántos títulos vistos por género
  minutes: 0,          // minutos totales reproducidos
  achSeen: [],         // logros ya mostrados
})

const sanitize = (raw) => {
  const base = empty()
  if (!raw || typeof raw !== 'object') return base
  return {
    ...base,
    ...raw,
    list: Array.isArray(raw.list) ? raw.list : [],
    history: Array.isArray(raw.history) ? raw.history : [],
    reminders: Array.isArray(raw.reminders) ? raw.reminders : [],
    days: Array.isArray(raw.days) ? raw.days : [],
    daily: raw.daily && typeof raw.daily === 'object' ? raw.daily : {},
    seen: raw.seen && typeof raw.seen === 'object' ? raw.seen : {},
    genres: raw.genres && typeof raw.genres === 'object' ? raw.genres : {},
    achSeen: Array.isArray(raw.achSeen) ? raw.achSeen : [],
    minutes: Number(raw.minutes) || 0,
  }
}

const read = () => {
  try { return sanitize(JSON.parse(localStorage.getItem(KEY) || 'null')) } catch { return empty() }
}

let state = read()
const listeners = new Set()

const persist = () => {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* modo privado / cuota */ }
}

const commit = (next) => {
  state = next
  persist()
  listeners.forEach((fn) => fn())
}

export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const getLibrary = () => state

/** React: re-renderiza cuando cambia la biblioteca. */
export const useLibrary = () => useSyncExternalStore(subscribe, getLibrary, getLibrary)

/** Solo para tests: vuelve a leer desde localStorage. */
export const reloadLibrary = () => { state = read(); listeners.forEach((fn) => fn()) }

// ─── Helpers ────────────────────────────────────────────────────────────
export const keyOf = (type, id) => `${type}:${id}`

export const todayStr = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Normaliza un resultado de TMDB (lista o detalle) al formato que guardamos. */
export const toLibItem = (raw, type) => {
  if (!raw) return null
  const t = type || (raw.first_air_date !== undefined || raw.name ? 'tv' : 'movie')
  const genres = Array.isArray(raw.genre_ids)
    ? raw.genre_ids
    : Array.isArray(raw.genres) ? raw.genres.map((g) => g.id) : []
  return {
    id: Number(raw.id),
    type: t,
    title: raw.title || raw.name || 'Sin título',
    poster: raw.poster_path || raw.poster || null,
    backdrop: raw.backdrop_path || raw.backdrop || null,
    date: raw.release_date || raw.first_air_date || raw.date || null,
    genres,
    ...(raw.number_of_seasons ? { totalSeasons: raw.number_of_seasons } : {}),
  }
}

const trim = (arr, max) => (arr.length > max ? arr.slice(0, max) : arr)

// ─── Mi lista ───────────────────────────────────────────────────────────
export const isInList = (lib, type, id) => lib.list.some((x) => x.type === type && x.id === Number(id))

export const toggleList = (item) => {
  if (!item?.id) return false
  const lib = state
  if (isInList(lib, item.type, item.id)) {
    commit({ ...lib, list: lib.list.filter((x) => !(x.type === item.type && x.id === item.id)) })
    return false
  }
  commit({ ...lib, list: trim([{ ...item, addedAt: Date.now() }, ...lib.list], LIST_MAX) })
  return true
}

// ─── Continuar viendo ───────────────────────────────────────────────────
/**
 * Suma segundos reproducidos a un título y actualiza rachas/estadísticas.
 * `item` = toLibItem(); para series, pasar season/episode.
 */
export const recordWatch = (item, { season = 1, episode = 1, runtimeMin = 0, seconds = 0 } = {}) => {
  if (!item?.id) return
  const lib = state
  const k = keyOf(item.type, item.id)
  const prev = lib.history.find((h) => keyOf(h.type, h.id) === k)
  const today = todayStr()

  const sameEpisode = !prev || item.type === 'movie' || (prev.season === season && prev.episode === episode)
  const watchedSec = (sameEpisode && prev ? prev.watchedSec : 0) + seconds
  const runtime = runtimeMin || prev?.runtimeMin || (item.type === 'tv' ? 40 : 100)
  const entry = {
    ...(prev || {}),
    ...item,
    // No pisamos un póster ya guardado con null
    poster: item.poster || prev?.poster || null,
    backdrop: item.backdrop || prev?.backdrop || null,
    season: item.type === 'tv' ? season : undefined,
    episode: item.type === 'tv' ? episode : undefined,
    runtimeMin: runtime,
    totalSeasons: item.totalSeasons || prev?.totalSeasons || 1,
    watchedSec,
    finished: watchedSec >= runtime * 60 * FINISHED_RATIO,
    updatedAt: Date.now(),
  }

  const history = trim([entry, ...lib.history.filter((h) => keyOf(h.type, h.id) !== k)], HISTORY_MAX)

  // Estadísticas
  const days = lib.days.includes(today) ? lib.days : [...lib.days, today].slice(-DAYS_MAX)
  const dayKeys = lib.daily[today] || []
  const epKey = item.type === 'tv' ? `${k}:s${season}e${episode}` : k
  const nextDay = dayKeys.includes(epKey) ? dayKeys : [...dayKeys, epKey]
  // Solo guardamos los últimos 14 días de detalle
  const dailyKeep = Object.keys(lib.daily).sort().slice(-13)
  const daily = { ...Object.fromEntries(dailyKeep.map((d) => [d, lib.daily[d]])), [today]: nextDay }

  let seen = lib.seen
  let genres = lib.genres
  if (!lib.seen[k]) {
    seen = { ...lib.seen, [k]: 1 }
    genres = { ...lib.genres }
    for (const g of item.genres || []) genres[g] = (genres[g] || 0) + 1
  }

  commit({ ...lib, history, days, daily, seen, genres, minutes: lib.minutes + seconds / 60 })
}

export const removeHistory = (type, id) => {
  const lib = state
  commit({ ...lib, history: lib.history.filter((h) => !(h.type === type && h.id === Number(id))) })
}

/** Progreso 0..1 estimado del episodio/película actual. */
export const progressOf = (h) => {
  const total = (h.runtimeMin || 0) * 60
  if (!total) return 0
  return Math.max(0, Math.min(1, (h.watchedSec || 0) / total))
}

/**
 * Lo que mostramos en "Continuar viendo":
 *  · películas sin terminar (con al menos 1 min vistos)
 *  · series: el episodio en curso, o el SIGUIENTE si ya terminó el actual
 */
export const continueWatching = (lib) =>
  lib.history
    .filter((h) => !h.dismissed)
    .map((h) => {
      if (h.type === 'movie') return h.finished ? null : (h.watchedSec >= 60 ? { ...h, next: false } : null)
      if (h.finished) return { ...h, next: true, nextEpisode: h.episode + 1, nextSeason: h.season, watchedSec: 0 }
      return h.watchedSec >= 60 ? { ...h, next: false } : null
    })
    .filter(Boolean)
    .sort((a, b) => b.updatedAt - a.updatedAt)

// ─── Recordatorios "Avisame cuando salga" ───────────────────────────────
export const isReminded = (lib, type, id) => lib.reminders.some((r) => r.type === type && r.id === Number(id))

export const toggleReminder = (item) => {
  if (!item?.id) return false
  const lib = state
  if (isReminded(lib, item.type, item.id)) {
    commit({ ...lib, reminders: lib.reminders.filter((r) => !(r.type === item.type && r.id === item.id)) })
    return false
  }
  commit({ ...lib, reminders: trim([{ ...item, addedAt: Date.now(), notified: false }, ...lib.reminders], REMINDERS_MAX) })
  return true
}

export const updateReminders = (updater) => {
  const lib = state
  const next = updater(lib.reminders)
  if (next !== lib.reminders) commit({ ...lib, reminders: next })
}

// ─── Logros vistos ──────────────────────────────────────────────────────
export const markAchievementsSeen = (ids) => {
  const lib = state
  const merged = Array.from(new Set([...lib.achSeen, ...ids]))
  if (merged.length !== lib.achSeen.length) commit({ ...lib, achSeen: merged })
}
