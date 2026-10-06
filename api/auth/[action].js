// Función de Vercel (Node) para todas las acciones de cuentas: /api/auth/<acción>
// register · login · logout · me · sync · forgot · reset · verify · resend-verification · password · delete · status
//
// Necesita la variable de entorno MONGODB_URI. Sin ella, las cuentas quedan deshabilitadas
// (/api/auth/status devuelve enabled:false) y el resto del sitio sigue funcionando igual.
// Opcionales: RESEND_API_KEY y MAIL_FROM (mails), SITE_URL (links de los mails), MONGODB_DB.

import { createAuthApi } from '../_lib/authApi.js'
import { createMailer } from '../_lib/mailer.js'
import { getStore } from '../_lib/stores.js'

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

  const api = createAuthApi({ store, mailer: createMailer(process.env), secureCookies: true })
  const out = await api({ method: req.method, action, headers: req.headers, body, ip: clientIp(req) })
  return send(res, out.status, out.body, out.cookies)
}
