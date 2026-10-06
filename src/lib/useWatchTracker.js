import { useEffect, useRef } from 'react'
import { recordWatch } from './library'
import { setWatching } from './watchState'

const TICK_SECONDS = 10
// Para el aviso de donación: ver al menos esto (en segundos) cuenta como "vio algo"
export const WATCH_END_EVENT = 'lifehigh:watch-end'

/**
 * Cuenta el tiempo REAL que el reproductor estuvo en "playing" con la pestaña visible
 * y lo vuelca a la biblioteca (Continuar viendo, rachas, logros).
 * Al cerrar el reproductor emite WATCH_END_EVENT con el tiempo de la sesión.
 */
export function useWatchTracker({ active, playing, item, season, episode, runtimeMin, persist = true }) {
  const sessionSec = useRef(0)
  const latest = useRef({})
  latest.current = { item, season, episode, runtimeMin, persist }

  // Para las estadísticas en vivo: "esta pestaña está viendo X" (el servidor calcula el tiempo)
  useEffect(() => {
    if (!active || !playing || !item?.id) { setWatching(null); return undefined }
    setWatching({ key: `${item.type}:${item.id}`, title: item.title, type: item.type })
    return () => setWatching(null)
  }, [active, playing, item?.id, item?.type, item?.title])

  // Tick mientras se reproduce
  useEffect(() => {
    if (!active || !playing) return undefined
    const id = setInterval(() => {
      if (document.hidden) return
      const { item: it, season: s, episode: e, runtimeMin: r, persist: keep } = latest.current
      if (!it?.id) return
      sessionSec.current += TICK_SECONDS
      // Sin cuenta se cuenta el tiempo (para el pedido de apoyo) pero NO se guarda en Continuar viendo
      if (keep) recordWatch(it, { season: s, episode: e, runtimeMin: r, seconds: TICK_SECONDS })
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
