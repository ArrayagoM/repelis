import { useEffect, useRef } from 'react'
import { recordWatch } from './library'

const TICK_SECONDS = 10
// Para el aviso de donación: ver al menos esto (en segundos) cuenta como "vio algo"
export const WATCH_END_EVENT = 'lifehigh:watch-end'

/**
 * Cuenta el tiempo REAL que el reproductor estuvo en "playing" con la pestaña visible
 * y lo vuelca a la biblioteca (Continuar viendo, rachas, logros).
 * Al cerrar el reproductor emite WATCH_END_EVENT con el tiempo de la sesión.
 */
export function useWatchTracker({ active, playing, item, season, episode, runtimeMin }) {
  const sessionSec = useRef(0)
  const latest = useRef({})
  latest.current = { item, season, episode, runtimeMin }

  // Tick mientras se reproduce
  useEffect(() => {
    if (!active || !playing) return undefined
    const id = setInterval(() => {
      if (document.hidden) return
      const { item: it, season: s, episode: e, runtimeMin: r } = latest.current
      if (!it?.id) return
      sessionSec.current += TICK_SECONDS
      recordWatch(it, { season: s, episode: e, runtimeMin: r, seconds: TICK_SECONDS })
    }, TICK_SECONDS * 1000)
    return () => clearInterval(id)
  }, [active, playing])

  // Al cerrar: avisamos cuánto se vio y reiniciamos la sesión
  useEffect(() => {
    if (active) return undefined
    const seconds = sessionSec.current
    sessionSec.current = 0
    if (seconds > 0 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(WATCH_END_EVENT, { detail: { seconds } }))
    }
    return undefined
  }, [active])
}
