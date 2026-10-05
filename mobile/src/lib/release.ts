import type { MediaItem } from '@/api/types'

const DAY = 86400000

const dateOf = (m: Pick<MediaItem, 'release_date' | 'first_air_date'>): number | null => {
  const str = m.release_date || m.first_air_date
  if (!str) return null
  const t = new Date(str).getTime()
  return Number.isNaN(t) ? null : t
}

// Para rankings: solo lo que YA se estrenó con fecha confirmada (margen de 1 día por zona horaria).
export const isOut = (m: MediaItem, now = Date.now()): boolean => {
  const t = dateOf(m)
  return t !== null && t <= now + DAY
}

// Estreno más cercano primero; sin fecha al final.
export const byReleaseDate = (a: MediaItem, b: MediaItem): number =>
  (dateOf(a) ?? Infinity) - (dateOf(b) ?? Infinity)
