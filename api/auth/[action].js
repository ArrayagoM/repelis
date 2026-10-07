// Función de Vercel (Node) para todas las acciones de cuentas: /api/auth/<acción>
// register · login · logout · me · sync · forgot · reset · verify · resend-verification · password · delete · status
//
// Necesita la variable de entorno MONGODB_URI. Sin ella, las cuentas quedan deshabilitadas
// (/api/auth/status devuelve enabled:false) y el resto del sitio sigue funcionando igual.
// Opcionales: GOOGLE_CLIENT_ID (ingreso con Google), RESEND_API_KEY y MAIL_FROM (mails), SITE_URL, MONGODB_DB.

import { createAuthApi } from '../_lib/authApi.js'
import { createMailer } from '../_lib/mailer.js'
import { getBackend, getStore, getSocial, getRooms } from '../_lib/stores.js'
import { parseRootEmails } from '../_lib/session.js'
import { getGoogleKeys, verifyGoogleIdToken } from '../_lib/google.js'

const send = (res, status, body, cookies) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (cookies?.length) res.setHeader('Set-Cookie', cookies)
  res.status(status).json(body)
}

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.headers['x-real-ip'] || req.socket?.remoteAddress || ''

export default async function handler(req, res) {
  const action = String(req.query?.action || '')

  if (!process.env.MONGODB_URI) {
    // Sin base de datos: las cuentas no están disponibles (el cliente lo muestra con cariño)
    if (action === 'status') return send(res, 200, { enabled: false, mail: false })
    return send(res, 503, { error: 'auth_unavailable' })
  }

  let store
  try {
    store = await getStore()
  } catch (e) {
    console.error('[auth] no se pudo conectar a MongoDB:', e?.message)
    return send(res, 503, { error: 'auth_unavailable' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }

  const googleClientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
  const verifyGoogle = googleClientId
    ? async (credential) => verifyGoogleIdToken(credential, { clientId: googleClientId, keys: await getGoogleKeys() })
    : null

  const api = createAuthApi({ store, mailer: createMailer(process.env, fetch, { log: async (m) => (await getBackend()).mail.add(m) }), secureCookies: true, googleClientId, verifyGoogle, rootEmails: parseRootEmails(process.env.ROOT_EMAILS),
    onUserDeleted: async (id) => { await (await getSocial()).deleteUserData(id); await (await getRooms()).deleteUserData(id) } })
  const out = await api({ method: req.method, action, headers: req.headers, body, ip: clientIp(req) })
  return send(res, out.status, out.body, out.cookies)
}
