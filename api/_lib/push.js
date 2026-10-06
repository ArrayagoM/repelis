// Notificaciones push web (Web Push + VAPID). Funciona en navegadores y en la app instalada (PWA/escritorio).
// Sin VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY queda deshabilitado y el resto de la comunidad sigue igual.
// Las claves se generan una vez con:  node -e "console.log(require('web-push').generateVAPIDKeys())"

const SEND_TIMEOUT_MS = 6000

/**
 * @param {{ webpush: { setVapidDetails, sendNotification }, publicKey: string, privateKey: string, subject?: string }} cfg
 */
export const createPush = ({ webpush, publicKey, privateKey, subject = 'mailto:info@lifehigh.site' }) => {
  if (!webpush || !publicKey || !privateKey) return null
  webpush.setVapidDetails(subject, publicKey, privateKey)

  /** Envía a todas las suscripciones. Devuelve las que ya no existen (404/410) para que se borren. */
  const send = async (subs, payload) => {
    const body = JSON.stringify({
      title: String(payload.title || 'Life High').slice(0, 80),
      body: String(payload.body || '').slice(0, 180),
      url: typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/',
      tag: payload.tag ? String(payload.tag).slice(0, 60) : undefined,
    })
    const gone = []
    let sent = 0
    await Promise.allSettled(subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, body, { TTL: 86400, timeout: SEND_TIMEOUT_MS, urgency: 'normal' })
        sent += 1
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(s.endpoint)
      }
    }))
    return { sent, gone }
  }

  return { publicKey, send }
}

/** Carga web-push solo si hay claves (no pesa en las funciones que no lo usan). */
export const loadPush = async (env = process.env) => {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null
  try {
    const mod = await import('web-push')
    return createPush({ webpush: mod.default || mod, publicKey: env.VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT || 'mailto:info@lifehigh.site' })
  } catch (e) {
    console.error('[push] no se pudo iniciar:', e?.message)
    return null
  }
}
