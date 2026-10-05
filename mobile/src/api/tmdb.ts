import type { Episode, Genre, MediaDetail, MediaItem, MediaType, Paged } from '@/api/types'

const BASE_URL = 'https://api.themoviedb.org/3'

// Token de lectura (v4, solo API_READ) — igual que en la web. Se puede sobreescribir con EXPO_PUBLIC_TMDB_TOKEN.
const FALLBACK_TOKEN =
  'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyM2RjYjQ5MDgwODc2YjMzNWQ4Njg0NDIzOTE1OGQ5NCIsIm5iZiI6MTc3NzIyOTc1MS4wODksInN1YiI6IjY5ZWU1ZmI3ODgzM2EyZDk5YjE3ZDljMSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.pO_Pt4O7iHbcnkvF84DqdLKvBLtdv7EKFJ-2OsTFqpY'
const TOKEN = process.env.EXPO_PUBLIC_TMDB_TOKEN || FALLBACK_TOKEN

export const IMG = 'https://image.tmdb.org/t/p'
export const poster = (path?: string | null, size: 'w185' | 'w342' | 'w500' = 'w342') =>
  path ? `${IMG}/${size}${path}` : undefined
export const backdrop = (path?: string | null, size: 'w780' | 'w1280' | 'original' = 'w780') =>
  path ? `${IMG}/${size}${path}` : undefined

type Params = Record<string, string | number | boolean | undefined>

const MAX_RETRIES = 3
const TIMEOUT_MS = 10000
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

const buildUrl = (path: string, params: Params): string => {
  const qs = new URLSearchParams({ language: 'es-MX' })
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v))
  }
  return `${BASE_URL}${path}?${qs.toString()}`
}

// Caché en memoria de 5 minutos: evita repetir pedidos al navegar entre pantallas.
const cache = new Map<string, { ts: number; data: unknown }>()
const CACHE_TTL = 5 * 60 * 1000

export async function get<T>(path: string, params: Params = {}): Promise<T> {
  const url = buildUrl(path, params)
  const hit = cache.get(url)
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data as T

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
        signal: controller.signal,
      })
      if (res.ok) {
        const data = (await res.json()) as T
        cache.set(url, { ts: Date.now(), data })
        return data
      }
      if (res.status < 500) throw new Error(`TMDB ${res.status}`)
      lastError = new Error(`TMDB ${res.status}`)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('TMDB 4')) throw e
      lastError = e
    } finally {
      clearTimeout(timer)
    }
    if (attempt < MAX_RETRIES) await sleep(500 * 2 ** attempt)
  }
  throw lastError instanceof Error ? lastError : new Error('Error de red')
}

export const clearCache = () => cache.clear()

// ── Catálogo ────────────────────────────────────────────────────────────
export type ListFetcher = (page: number, extra?: Params) => Promise<Paged<MediaItem>>

const list = (path: string, base: Params = {}): ListFetcher => (page, extra = {}) =>
  get<Paged<MediaItem>>(path, { ...base, ...extra, page })

export const movies = {
  trending: list('/trending/movie/week'),
  trendingDay: list('/trending/movie/day'),
  popular: list('/movie/popular'),
  topRated: list('/movie/top_rated'),
  nowPlaying: list('/movie/now_playing'),
  upcoming: list('/movie/upcoming'),
  classics: list('/discover/movie', {
    'vote_average.gte': 7.5,
    'vote_count.gte': 1000,
    'release_date.lte': '1994-12-31',
    sort_by: 'vote_average.desc',
  }),
  animeMovies: list('/discover/movie', { with_genres: 16, with_origin_country: 'JP', sort_by: 'popularity.desc' }),
  discover: list('/discover/movie', { sort_by: 'popularity.desc' }),
  // Muy bien valoradas pero poco conocidas (pocos votos = menos famosas)
  hiddenGems: list('/discover/movie', {
    sort_by: 'vote_average.desc', 'vote_average.gte': 7.4, 'vote_count.gte': 300, 'vote_count.lte': 2500,
  }),
  family: list('/discover/movie', {
    with_genres: '10751,16', certification_country: 'US', 'certification.lte': 'PG', sort_by: 'popularity.desc',
  }),
}

export const tv = {
  trending: list('/trending/tv/week'),
  trendingDay: list('/trending/tv/day'),
  // Nota alta con muchos votos (evita series con 3 votos en 10/10)
  mostRecommended: list('/discover/tv', { sort_by: 'vote_average.desc', 'vote_count.gte': 1500 }),
  popular: list('/tv/popular'),
  topRated: list('/tv/top_rated'),
  airingToday: list('/tv/airing_today'),
  anime: list('/discover/tv', { with_genres: 16, with_origin_country: 'JP', sort_by: 'popularity.desc' }),
  kdrama: list('/discover/tv', { with_origin_country: 'KR', sort_by: 'popularity.desc' }),
  discover: list('/discover/tv', { sort_by: 'popularity.desc' }),
}

export const getGenres = (type: MediaType) =>
  get<{ genres: Genre[] }>(`/genre/${type}/list`).then((r) => r.genres)

// ── Detalle ─────────────────────────────────────────────────────────────
export const getDetail = (type: MediaType, id: number | string) =>
  get<MediaDetail>(`/${type}/${id}`, { append_to_response: 'credits,similar' })

export const getSeason = (id: number | string, season: number) =>
  get<{ episodes: Episode[] }>(`/tv/${id}/season/${season}`).then((r) => r.episodes)

// ── Búsqueda ────────────────────────────────────────────────────────────
export const searchMulti = (query: string, page = 1) =>
  get<Paged<MediaItem>>('/search/multi', { query, page, include_adult: false })
