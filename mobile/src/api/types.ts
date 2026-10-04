export type MediaType = 'movie' | 'tv'

export interface MediaItem {
  id: number
  media_type?: string
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  popularity?: number
  release_date?: string
  first_air_date?: string
  original_language?: string
  origin_country?: string[]
}

export interface Paged<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

export interface Genre {
  id: number
  name: string
}

export interface CastMember {
  id: number
  name: string
  character?: string
  profile_path?: string | null
}

export interface Season {
  season_number: number
  name: string
  episode_count: number
  poster_path?: string | null
}

export interface Episode {
  id: number
  episode_number: number
  name: string
  overview?: string
  still_path?: string | null
  runtime?: number | null
  air_date?: string | null
}

export interface SpokenLanguage {
  iso_639_1: string
  name: string
  english_name?: string
}

export interface MediaDetail extends MediaItem {
  tagline?: string
  runtime?: number
  episode_run_time?: number[]
  genres?: Genre[]
  status?: string
  number_of_seasons?: number
  seasons?: Season[]
  spoken_languages?: SpokenLanguage[]
  credits?: { cast: CastMember[] }
  similar?: Paged<MediaItem>
}

export const titleOf = (m: Pick<MediaItem, 'title' | 'name'>): string => m.title || m.name || 'Sin título'

export const yearOf = (m: Pick<MediaItem, 'release_date' | 'first_air_date'>): string =>
  (m.release_date || m.first_air_date || '').slice(0, 4)
