// Contador de avisos sin leer (campanita). Pregunta al servidor cada minuto mientras la pestaña está visible.
import { useEffect, useSyncExternalStore } from 'react'
import { useAuth } from './auth'
import { social } from './social'

const EVERY_MS = 60_000
let count = 0
const listeners = new Set()
const set = (n) => { if (n !== count) { count = n; listeners.forEach((fn) => fn()) } }

export const setUnread = (n) => set(Math.max(0, Number(n) || 0))
export const refreshUnread = async () => {
  const r = await social.unread()
  if (r.ok) set(Number(r.data.unread) || 0)
}

export const useUnread = () => {
  const { status } = useAuth()
  const value = useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn) }, () => count, () => 0)
  useEffect(() => {
    if (status !== 'in') { set(0); return undefined }
    refreshUnread()
    const t = setInterval(() => { if (!document.hidden) refreshUnread() }, EVERY_MS)
    const onVisible = () => { if (!document.hidden) refreshUnread() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible) }
  }, [status])
  return status === 'in' ? value : 0
}
