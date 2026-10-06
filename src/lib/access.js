// ─────────────────────────────────────────────────────────────────────────
// Qué títulos piden cuenta (gratis) para REPRODUCIRSE.
//
//  · Buscar, ver listados y fichas es libre para todos.
//  · Se piden cuenta solo para dar play a los títulos más calificados o más populares.
//  · Todo lo demás se reproduce sin registrarse.
//  · Es automático (por los datos de TMDB): no hay listas armadas a mano.
//
// IMPORTANTE: es un límite "de cortesía" del lado del navegador. El video lo sirven reproductores
// de terceros, así que alguien técnico puede saltearlo. Sirve para invitar a registrarse, no como seguridad.
//
// Los números salen de calibrar contra listas reales de TMDB (≈25 % de las películas conocidas
// quedan con cuenta; el resto se ve libre). Las series usan otra escala de popularidad.
// ─────────────────────────────────────────────────────────────────────────

export const ACCESS_RULES = {
  movie: { rating: 7.5, votes: 1000, popularity: 150 },
  tv:    { rating: 7.5, votes: 1000, popularity: 500 },
}

/**
 * @param {{ type?: string, rating?: number, votes?: number, pop?: number }|null} item  (formato de toLibItem)
 * @returns {boolean} true si para reproducirlo hace falta tener cuenta
 */
export const requiresAccount = (item) => {
  if (!item) return false
  const rule = ACCESS_RULES[item.type === 'tv' ? 'tv' : 'movie']
  // Sin datos (null/undefined/NaN) las comparaciones dan false: ante la duda, se deja ver
  const acclaimed = Number(item.rating) >= rule.rating && Number(item.votes) >= rule.votes
  const popular = Number(item.pop) >= rule.popularity
  return acclaimed || popular
}

/** ¿Debe frenarse la reproducción? Solo con cuentas disponibles y sin sesión (si el servicio falla, se deja ver). */
export const isLockedForUser = (item, authStatus) =>
  requiresAccount(item) && (authStatus === 'out' || authStatus === 'loading')

/**
 * Mi lista, Continuar viendo, recomendadas, nuevos capítulos y logros son SOLO para quien tiene cuenta.
 * Si el servicio de cuentas no está disponible, se mantienen locales (no dejamos a nadie sin la función por una caída).
 */
export const canUsePersonal = (authStatus) => authStatus === 'in' || authStatus === 'unavailable'

/** Ruta interna segura para volver tras ingresar (evita redirecciones a otros sitios). */
export const safeRedirect = (value) => {
  if (typeof value !== 'string' || value.length > 200) return null
  if (!/^\/(?!\/)[^\s\\]*$/.test(value)) return null
  if (value.startsWith('/cuenta') || value.startsWith('/api')) return null
  return value
}
