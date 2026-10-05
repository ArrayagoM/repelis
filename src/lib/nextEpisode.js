// Lógica del "Siguiente episodio" (pura, testeable).

const AUTONEXT_KEY = 'lifehigh:autonext:v1'

/** Próximo episodio, o null si es el último de la última temporada. */
export const nextTarget = ({ season, episode, episodeCount, totalSeasons }) => {
  // Si no sabemos cuántos episodios tiene la temporada, asumimos que hay uno más.
  if (!episodeCount || episode < episodeCount) return { season, episode: episode + 1 }
  if (season < (totalSeasons || 1)) return { season: season + 1, episode: 1 }
  return null
}

// A partir de este % de la duración, el episodio "parece terminado"
export const ENDING_RATIO = 0.93

/** ¿Mostramos el cartel de "Siguiente episodio"? */
export const shouldOfferNext = ({ watchedSec, runtimeMin, isTV, hasNext }) => {
  if (!isTV || !hasNext || !runtimeMin) return false
  return watchedSec >= runtimeMin * 60 * ENDING_RATIO
}

export const getAutoNext = () => {
  try { return localStorage.getItem(AUTONEXT_KEY) !== '0' } catch { return true }
}
export const setAutoNext = (on) => {
  try { localStorage.setItem(AUTONEXT_KEY, on ? '1' : '0') } catch { /* sin storage */ }
}
