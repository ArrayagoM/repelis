import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { usePathname } from 'expo-router'
import { useAuth } from '@/lib/auth'
import { getWatching, pageGroup, sendHeartbeat, subscribeWatching } from '@/lib/pulse'

// Misma cadencia que la web (cuida el cupo del plan gratis): mirando → un latido por minuto; navegando → cada 2 minutos.
const TICK_MS = 60_000

/** Manda el latido anónimo de estadísticas. No renderiza nada. No cuenta al fundador ni si las cuentas no están disponibles. */
export function PulseReporter() {
  const { status, user } = useAuth()
  const pathname = usePathname()
  const page = pageGroup(pathname)
  const active = (status === 'in' || status === 'out') && !user?.root
  const member = status === 'in'

  const live = useRef({ page, member })
  live.current = { page, member }
  const ticks = useRef(0)
  const lastSent = useRef(0)

  const beat = (nav = false) => {
    lastSent.current = Date.now()
    void sendHeartbeat(live.current.page, live.current.member, nav)
  }

  // Cada cambio de pantalla = una vista
  useEffect(() => {
    if (active && page) beat(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, active])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      const watching = getWatching()
      if (AppState.currentState !== 'active' && !watching) return
      ticks.current += 1
      if (!watching && ticks.current % 2 === 1) return
      beat(false)
    }, TICK_MS)
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && Date.now() - lastSent.current > 20_000) beat(false)
    })
    const off = subscribeWatching((w) => { if (w) beat(false) })
    return () => { clearInterval(id); sub.remove(); off() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return null
}
