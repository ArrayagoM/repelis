import { getMovieRecommendations, getTVRecommendations } from '../api/tmdb'
import { isOut } from './releaseStatus'
import { keyOf } from './library'

const CACHE_KEY = 'lifehigh:forYou:v1'
const CACHE_TTL = 30 * 60 * 1000
const MAX_SEEDS = 4
export const FOR_YOU_LIMIT = 20

/** Títulos "semilla": lo último que viste y, después, lo que guardaste. */
export const pickSeeds = (lib, max = MAX_SEEDS) => {
  const seen = new Set()
  const out = []
  const push = (x) => {
    const k = keyOf(x.type, x.id)
    if (!seen.has(k) && out.length < max) { seen.add(k); out.push(x) }
  }
  ;[...lib.history].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(push)
  lib.list.forEach(push)
  return out
}

/**
 * Junta las recomendaciones de varias semillas. Puro.
 *  · lo que recomiendan VARIAS semillas sube
 *  · nunca devuelve lo que ya viste/guardaste ni estrenos futuros
 * @param {Array<{type:string, results:Array}>} lists
 * @param {Set<string>} exclude claves 'type:id'
 */
export const mergeRecommendations = (lists, exclude = new Set(), limit = FOR_YOU_LIMIT) => {
  const acc = new Map()
  for (const { type, results } of lists) {
    for (const r of results || []) {
      const k = keyOf(type, r.id)
      if (exclude.has(k) || !isOut({ ...r })) continue
      const prev = acc.get(k)
      if (prev) prev.votes += 1
      else acc.set(k, { ...r, media: type, votes: 1 })
    }
  }
  return [...acc.values()]
    .sort((a, b) => b.votes - a.votes || (b.popularity || 0) - (a.popularity || 0))
    .slice(0, limit)
}

const readCache = () => { try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || '{}') } catch { return {} } }
const writeCache = (c) => { try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* sin storage */ } }

export const loadForYou = async (lib) => {
  const seeds = pickSeeds(lib)
  if (!seeds.length) return []
  const exclude = new Set([...lib.history, ...lib.list].map((x) => keyOf(x.type, x.id)))
  const cache = readCache()

  const lists = await Promise.all(seeds.map(async (s) => {
    const k = keyOf(s.type, s.id)
    const hit = cache[k]
    if (hit && Date.now() - hit.ts < CACHE_TTL) return { type: s.type, results: hit.results }
    try {
      const { data } = await (s.type === 'tv' ? getTVRecommendations(s.id) : getMovieRecommendations(s.id))
      const results = (data.results || []).map((r) => ({
        id: r.id, title: r.title, name: r.name, poster_path: r.poster_path,
        release_date: r.release_date, first_air_date: r.first_air_date, popularity: r.popularity,
      }))
      cache[k] = { ts: Date.now(), results }
      return { type: s.type, results }
    } catch { return { type: s.type, results: [] } }
  }))
  writeCache(cache)
  return mergeRecommendations(lists, exclude)
}
