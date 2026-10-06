// Comunidad: /api/social/<acción>
// GET  profile · me · list · feed          POST profile · list · list-add · list-delete · like · follow · report
//      comments · POST comment · comment-delete · comment-report
//      notifications · unread · POST notifications-read · notify-prefs · push-subscribe · push-unsubscribe
// Lectura de perfiles y listas públicas: libre. Escribir/interactuar: requiere cuenta. Lógica en api/_lib/socialApi.js.

import { createSocialApi } from '../_lib/socialApi.js'
import { parseRootEmails } from '../_lib/session.js'
import { getBackend } from '../_lib/stores.js'
import { loadPush } from '../_lib/push.js'

let pushPromise = null
const getPush = () => (pushPromise ||= loadPush())

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (!process.env.MONGODB_URI) return res.status(503).json({ error: 'auth_unavailable' })

  try {
    const { store, social } = await getBackend()
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    const api = createSocialApi({ store, social, push: await getPush(), rootEmails: parseRootEmails(process.env.ROOT_EMAILS) })
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || ''
    const out = await api({ method: req.method, action: String(req.query?.action || ''), headers: req.headers, body, query: req.query || {}, ip })
    return res.status(out.status).json(out.body)
  } catch (e) {
    console.error('[social]', e?.message)
    return res.status(503).json({ error: 'auth_unavailable' })
  }
}
