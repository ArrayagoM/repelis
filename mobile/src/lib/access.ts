// Qué títulos piden cuenta (gratis) para REPRODUCIRSE. Mismas reglas que la web (src/lib/access.js): mantener en sync.
// Buscar y ver fichas es libre; solo el play de los títulos más calificados o más populares pide cuenta.

export const ACCESS_RULES = {
  movie: { rating: 7.5, votes: 1000, popularity: 150 },
  tv: { rating: 7.5, votes: 1000, popularity: 500 },
} as const

export interface AccessItem {
  type?: string
  rating?: number | null
  votes?: number | null
  pop?: number | null
}

export type AuthStatus = 'loading' | 'in' | 'out' | 'unavailable'

export const requiresAccount = (item: AccessItem | null | undefined): boolean => {
  if (!item) return false
  const rule = ACCESS_RULES[item.type === 'tv' ? 'tv' : 'movie']
  // Sin datos (null/undefined/NaN) las comparaciones dan false: ante la duda, se deja ver
  const acclaimed = Number(item.rating) >= rule.rating && Number(item.votes) >= rule.votes
  const popular = Number(item.pop) >= rule.popularity
  return acclaimed || popular
}

/** Frena la reproducción solo con cuentas disponibles y sin sesión (si el servicio falla, se deja ver). */
export const isLockedForUser = (item: AccessItem | null | undefined, status: AuthStatus): boolean =>
  requiresAccount(item) && (status === 'out' || status === 'loading')
