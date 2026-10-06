// Salas (cine digital): /api/rooms/<acción>
// GET  room · mine          POST create · join · leave · sync · say · react · update · close · kick
// Ver los datos de una sala es libre; entrar, chatear y crear requiere cuenta. Lógica en api/_lib/roomsApi.js.

import { createRoomsApi } from '../_lib/roomsApi.js'
import { parseRootEmails } from '../_lib/session.js'
import { getBackend } from '../_lib/stores.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (!process.env.MONGODB_URI) return res.status(503).json({ error: 'auth_unavailable' })

  try {
    const { store, social, rooms } = await getBackend()
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    const api = createRoomsApi({ store, social, rooms, rootEmails: parseRootEmails(process.env.ROOT_EMAILS) })
    const out = await api({ method: req.method, action: String(req.query?.action || ''), headers: req.headers, body, query: req.query || {} })
    return res.status(out.status).json(out.body)
  } catch (e) {
    console.error('[rooms]', e?.message)
    return res.status(503).json({ error: 'auth_unavailable' })
  }
}
