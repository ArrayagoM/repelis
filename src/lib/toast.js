// Avisos chicos dentro de la app (logros, estrenos, agradecimientos…).
// Bus mínimo: showToast() desde cualquier lado, <ToastHost/> los dibuja.

const listeners = new Set()
let seq = 0

export const subscribeToasts = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

/**
 * @param {{ icon?: string, title: string, text?: string, actionLabel?: string,
 *           to?: string, onAction?: Function, ttl?: number, tone?: 'gold'|'blue'|'green' }} t
 */
export const showToast = (t) => {
  const toast = { id: ++seq, ttl: 7000, tone: 'gold', ...t }
  listeners.forEach((fn) => fn(toast))
  return toast.id
}
