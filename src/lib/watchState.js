// Qué se está reproduciendo AHORA en esta pestaña (lo escribe el reproductor, lo lee el latido de estadísticas).
let current = null
const listeners = new Set()

/** @param {{ key: string, title: string, type: 'movie'|'tv' } | null} value */
export const setWatching = (value) => {
  const same = (!value && !current) || (value && current && value.key === current.key)
  current = value
  if (!same) listeners.forEach((fn) => fn(current))
}
export const getWatching = () => current
export const subscribeWatching = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
