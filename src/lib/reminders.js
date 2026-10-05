import { todayStr } from './library'

const addDays = (str, n) => {
  const [y, m, d] = str.split('-').map(Number)
  return todayStr(new Date(y, m - 1, d + n))
}

/**
 * Decide qué avisar. Puro (testeable).
 *  · released: la fecha de estreno ya llegó y no avisamos todavía
 *  · tomorrow: se estrena mañana y no avisamos "mañana" todavía
 */
export const reminderActions = (reminders, today = todayStr()) => {
  const tomorrow = addDays(today, 1)
  const released = []
  const soon = []
  for (const r of reminders) {
    if (!r.date) continue
    if (r.date <= today) { if (!r.notified) released.push(r) }
    else if (r.date === tomorrow && !r.notifiedSoon) soon.push(r)
  }
  return { released, soon }
}

export const dateLabel = (str) => {
  if (!str) return ''
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })
}

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window

/** Notificación del sistema si el usuario dio permiso (se muestra al abrir la app). */
export const systemNotify = async (title, body, url) => {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  const opts = { body, icon: '/icon-192.png', badge: '/icon-192.png', data: { url }, tag: `lh-${url}` }
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg?.showNotification) { await reg.showNotification(title, opts); return true }
    new Notification(title, opts)
    return true
  } catch { return false }
}
