import { getTVDetail } from '../api/tmdb'
import { todayStr } from './library'

const CACHE_KEY = 'lifehigh:tvstatus:v1'
const CACHE_TTL = 30 * 60 * 1000
const MAX_SHOWS = 15
const NEW_WINDOW_DAYS = 7      // un episodio es "nuevo" hasta 7 días después de emitirse
const SOON_WINDOW_DAYS = 14

const dayDiff = (a, b) => {
  const p = (s) => { const [y, m, d] = s.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  return Math.round((p(a) - p(b)) / 86400000)
}

/** Series que el usuario sigue = las de Mi lista + las que está viendo (sin repetir, lo último primero). */
export const followedShows = (lib) => {
  const seen = new Set()
  const out = []
  const push = (x) => { if (x.type === 'tv' && !seen.has(x.id)) { seen.add(x.id); out.push(x) } }
  ;[...lib.history].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(push)
  lib.list.forEach(push)
  return out.slice(0, MAX_SHOWS)
}

const brief = (ep) => (ep ? { date: ep.air_date || null, season: ep.season_number, episode: ep.episode_number, name: ep.name || '' } : null)

/**
 * Clasifica una serie según su último/próximo episodio. Puro.
 *  · 'new'  → salió un episodio en los últimos 7 días
 *  · 'soon' → sale uno en los próximos 14 días
 */
export const classifyShow = (status, today = todayStr()) => {
  if (!status) return null
  const { last, next } = status
  if (last?.date) {
    const ago = dayDiff(today, last.date)
    if (ago >= 0 && ago <= NEW_WINDOW_DAYS) return { kind: 'new', ...last, daysAgo: ago }
  }
  if (next?.date) {
    const inDays = dayDiff(next.date, today)
    if (inDays >= 0 && inDays <= SOON_WINDOW_DAYS) return { kind: 'soon', ...next, inDays }
  }
  return null
}

const readCache = () => { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') } catch { return {} } }
const writeCache = (c) => { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* sin storage */ } }

const fetchStatus = async (id, cache) => {
  const hit = cache[id]
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.status
  try {
    const { data } = await getTVDetail(id)
    const status = { last: brief(data.last_episode_to_air), next: brief(data.next_episode_to_air) }
    cache[id] = { ts: Date.now(), status }
    return status
  } catch { return null }
}

/** Devuelve [{ show, info }] para las series seguidas que tienen novedades. */
export const loadNewEpisodes = async (lib) => {
  const shows = followedShows(lib)
  if (!shows.length) return []
  const cache = readCache()
  const statuses = await Promise.all(shows.map((s) => fetchStatus(s.id, cache)))
  writeCache(cache)
  return shows
    .map((show, i) => ({ show, info: classifyShow(statuses[i]) }))
    .filter((x) => x.info)
    .sort((a, b) => (a.info.kind === b.info.kind ? 0 : a.info.kind === 'new' ? -1 : 1))
}
