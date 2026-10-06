// Notificaciones push del navegador (Web Push). Se piden SOLO por un gesto de la persona (botón), nunca solas.
import { social } from './social'

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

/** base64url → Uint8Array (formato que pide pushManager.subscribe) */
export const urlBase64ToUint8Array = (b64) => {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

const registration = async () => {
  const reg = await navigator.serviceWorker.getRegistration()
  return reg || navigator.serviceWorker.register('/sw.js')
}

/** Estado de este dispositivo: 'unsupported' | 'denied' | 'on' | 'off' */
export const devicePushState = async () => {
  if (!pushSupported()) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    return sub && Notification.permission === 'granted' ? 'on' : 'off'
  } catch { return 'off' }
}

/** Activa el push en este dispositivo. Devuelve { ok } o { ok:false, reason }. */
export const enablePush = async (publicKey) => {
  if (!pushSupported()) return { ok: false, reason: 'unsupported' }
  if (!publicKey) return { ok: false, reason: 'unavailable' }
  const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (perm !== 'granted') return { ok: false, reason: 'denied' }
  try {
    const reg = await registration()
    await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription())
      || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }))
    const r = await social.pushSubscribe(sub.toJSON())
    return r.ok ? { ok: true } : { ok: false, reason: 'server' }
  } catch { return { ok: false, reason: 'failed' } }
}

export const disablePush = async () => {
  if (!pushSupported()) return { ok: true }
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = await reg?.pushManager.getSubscription()
    if (sub) { await social.pushUnsubscribe(sub.endpoint); await sub.unsubscribe() }
    return { ok: true }
  } catch { return { ok: false } }
}
