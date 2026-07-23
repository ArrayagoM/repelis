// Determina si una película/serie ya se estrenó (y por ende podría estar en
// los servidores de streaming). Las no estrenadas NO están en ningún server,
// así que las marcamos para que el usuario no pierda tiempo clickeándolas.

const parseDate = (str) => {
  if (!str) return null
  const t = new Date(str).getTime()
  return Number.isNaN(t) ? null : t
}

/**
 * @returns 'released' | 'upcoming' | 'unknown'
 * released  → fecha de estreno <= hoy
 * upcoming  → fecha de estreno en el futuro (NO disponible en servers)
 * unknown   → sin fecha (asumimos released para no ocultar de más)
 */
export const getReleaseStatus = (item) => {
  if (!item) return 'unknown'
  const dateStr = item.release_date || item.first_air_date
  const ts = parseDate(dateStr)
  if (ts == null) return 'unknown'
  // Margen de 1 día por zonas horarias
  return ts <= Date.now() + 24 * 60 * 60 * 1000 ? 'released' : 'upcoming'
}

export const isUpcoming = (item) => getReleaseStatus(item) === 'upcoming'
export const isReleased = (item) => getReleaseStatus(item) !== 'upcoming'

// Días hasta el estreno (para mostrar "en 12 días"). null si ya salió.
export const daysUntilRelease = (item) => {
  const ts = parseDate(item?.release_date || item?.first_air_date)
  if (ts == null) return null
  const diff = ts - Date.now()
  if (diff <= 0) return null
  return Math.ceil(diff / (24 * 60 * 60 * 1000))
}
