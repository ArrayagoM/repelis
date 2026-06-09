// ─────────────────────────────────────────────────────────────────────────
// Motor de búsqueda con cache, debounce, multi-source y filtros.
// ─────────────────────────────────────────────────────────────────────────

import { searchMulti } from '../api/tmdb'

// ─── Cache en memoria + localStorage (TTL 1h) ─────────────────────────────
const MEMORY_CACHE = new Map()
const LS_KEY = 'repelis:searchCache:v1'
const TTL_MS = 60 * 60 * 1000

const hydrate = () => {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return
    const data = JSON.parse(raw)
    for (const [k, v] of Object.entries(data)) {
      if (v?.ts && Date.now() - v.ts < TTL_MS) MEMORY_CACHE.set(k, v)
    }
  } catch {}
}
hydrate()

const persist = () => {
  try {
    const obj = {}
    for (const [k, v] of MEMORY_CACHE) obj[k] = v
    localStorage.setItem(LS_KEY, JSON.stringify(obj))
  } catch {}
}

const cacheKey = (query) => `q:${query.toLowerCase().trim()}`

// ─── Historial de búsquedas (últimas 12) ──────────────────────────────────
const HIST_KEY = 'repelis:searchHistory:v1'
const HIST_MAX = 12

export const getHistory = () => {
  try { return JSON.parse(localStorage.getItem(HIST_KEY) || '[]') } catch { return [] }
}
export const addToHistory = (query) => {
  if (!query || query.length < 2) return
  const q = query.trim()
  const list = getHistory().filter((x) => x.toLowerCase() !== q.toLowerCase())
  list.unshift(q)
  try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, HIST_MAX))) } catch {}
}
export const clearHistory = () => {
  try { localStorage.removeItem(HIST_KEY) } catch {}
}
export const removeFromHistory = (query) => {
  const list = getHistory().filter((x) => x.toLowerCase() !== query.toLowerCase())
  try { localStorage.setItem(HIST_KEY, JSON.stringify(list)) } catch {}
}

// ─── Búsqueda principal con cache y filtros ───────────────────────────────
/**
 * Busca en TMDB multi-search con cache.
 * @param {string} query
 * @param {object} options
 *   - kind: 'all' | 'movie' | 'tv' | 'person'
 *   - minYear / maxYear: número
 *   - minRating: 0-10
 *   - language: ISO 639-1 (filtra original_language)
 *   - sort: 'popularity' | 'rating' | 'year-desc' | 'year-asc'
 *   - page: número (TMDB pagination)
 */
export const searchSmart = async (query, options = {}) => {
  if (!query || query.trim().length < 2) {
    return { results: [], page: 0, totalPages: 0, fromCache: false }
  }

  const trimmed = query.trim()
  const key = cacheKey(trimmed) + '|p' + (options.page || 1)
  const cached = MEMORY_CACHE.get(key)
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return { ...applyFilters(cached.data, options), fromCache: true }
  }

  const { data } = await searchMulti(trimmed, options.page || 1)
  // Filtra personas sin foto y películas sin póster para no inflar resultados
  const cleaned = (data.results || []).filter((r) => {
    if (r.media_type === 'person') return !!r.profile_path
    return !!r.poster_path
  })

  const payload = {
    results: cleaned,
    page: data.page,
    totalPages: data.total_pages,
    totalResults: data.total_results,
  }

  MEMORY_CACHE.set(key, { ts: Date.now(), data: payload })
  persist()
  return { ...applyFilters(payload, options), fromCache: false }
}

// ─── Filtros y ordenamiento locales (post-fetch) ──────────────────────────
const applyFilters = (payload, options) => {
  let r = payload.results

  if (options.kind && options.kind !== 'all') {
    r = r.filter((x) => x.media_type === options.kind)
  }
  if (options.language) {
    r = r.filter((x) => x.original_language === options.language)
  }
  if (options.minRating != null) {
    r = r.filter((x) => (x.vote_average ?? 0) >= options.minRating)
  }
  if (options.minYear != null || options.maxYear != null) {
    r = r.filter((x) => {
      const date = x.release_date || x.first_air_date
      if (!date) return false
      const y = Number(date.slice(0, 4))
      if (options.minYear != null && y < options.minYear) return false
      if (options.maxYear != null && y > options.maxYear) return false
      return true
    })
  }

  if (options.sort === 'rating') {
    r = [...r].sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
  } else if (options.sort === 'year-desc') {
    r = [...r].sort((a, b) => yr(b) - yr(a))
  } else if (options.sort === 'year-asc') {
    r = [...r].sort((a, b) => yr(a) - yr(b))
  } else {
    r = [...r].sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
  }

  return { ...payload, results: r }
}

const yr = (x) => Number((x.release_date || x.first_air_date || '0000').slice(0, 4)) || 0

// ─── Helpers de UI ────────────────────────────────────────────────────────
export const getTitle  = (item) => item.title || item.name || ''
export const getYear   = (item) => yr(item) || null
export const isPerson  = (item) => item.media_type === 'person'
export const isMovie   = (item) => item.media_type === 'movie'
export const isTV      = (item) => item.media_type === 'tv'

// Tests pueden necesitar esto
export const _resetCache = () => { MEMORY_CACHE.clear(); try { localStorage.removeItem(LS_KEY) } catch {} }
