// Me gusta de películas/series y comentarios, compartidos entre componentes de la misma pantalla
// (el corazón de arriba de la ficha y el de la sección de opiniones muestran siempre lo mismo).
import { useSyncExternalStore } from 'react'

const state = new Map()          // clave → { count, liked }
const listeners = new Set()
const emit = () => listeners.forEach((fn) => fn())
let version = 0

/** Carga valores que vienen del servidor (sin pisar un cambio optimista en curso). */
export const seedReactions = (entries) => {
  let changed = false
  for (const [k, v] of entries) {
    const cur = state.get(k)
    if (!cur || cur.count !== v.count || cur.liked !== v.liked) { state.set(k, { count: v.count, liked: !!v.liked }); changed = true }
  }
  if (changed) { version += 1; emit() }
}
export const setReaction = (k, v) => { state.set(k, v); version += 1; emit() }
export const getReaction = (k) => state.get(k) || null

/** Valor actual de una clave (o el de respaldo mientras no haya datos). */
export const useReaction = (k, fallback = { count: 0, liked: false }) => {
  useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn) }, () => version, () => 0)
  return state.get(k) || fallback
}
