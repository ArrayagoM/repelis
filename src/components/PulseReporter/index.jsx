import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { getWatching, subscribeWatching } from '../../lib/watchState'
import { pageGroup, sendHeartbeat, setPulseEnabled } from '../../lib/pulse'

// Cadencia pensada para no gastar el cupo de invocaciones del plan gratuito de Vercel (1 M/mes):
// mirando → un latido por minuto; solo navegando → uno cada 2 minutos (cada 2 ticks)
const TICK_MS = 60_000

/**
 * Manda el latido anónimo de estadísticas. No renderiza nada.
 * Solo corre si hay servicio de cuentas/base (si no, las estadísticas están apagadas) y no cuenta al fundador.
 */
export default function PulseReporter() {
  const { status, user } = useAuth()
  const { pathname } = useLocation()
  const page = pageGroup(pathname)
  const active = (status === 'in' || status === 'out') && !user?.root
  const member = status === 'in'

  // Valores actuales sin reiniciar el intervalo en cada render
  const live = useRef({})
  live.current = { page, member }
  const ticks = useRef(0)
  const lastSent = useRef(0)
  const stopped = useRef(false)

  const beat = (nav = false) => {
    if (stopped.current) return
    lastSent.current = Date.now()
    const { page: p, member: m } = live.current
    sendHeartbeat({ page: p, nav, watching: getWatching(), member: m }).then((keepGoing) => { if (!keepGoing) stopped.current = true })
  }

  useEffect(() => { setPulseEnabled(active); return () => setPulseEnabled(false) }, [active])

  // Cada cambio de página = una vista
  useEffect(() => { if (active && page) beat(true) }, [page, active]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!active) return undefined
    const id = setInterval(() => {
      const watching = getWatching()
      if (document.hidden && !watching) return                 // pestaña en segundo plano sin video: no cuenta
      ticks.current += 1
      if (!watching && ticks.current % 2 === 1) return         // navegando: latido cada 2 min
      beat(false)
    }, TICK_MS)

    const onVisible = () => { if (!document.hidden && Date.now() - lastSent.current > 20_000) beat(false) }
    document.addEventListener('visibilitychange', onVisible)
    // Al empezar a mirar algo, avisamos enseguida (así la reproducción se cuenta en el momento)
    const off = subscribeWatching((w) => { if (w) beat(false) })

    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible); off() }
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}
