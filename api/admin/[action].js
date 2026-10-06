// Panel del fundador: /api/admin/realtime y /api/admin/dashboard?days=1|7|30
// Solo para cuentas root (ROOT_EMAILS). Lógica y permisos en api/_lib/adminApi.js.

import { createAdminApi } from '../_lib/adminApi.js'
import { parseRootEmails } from '../_lib/session.js'
import { getBackend } from '../_lib/stores.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (!process.env.MONGODB_URI) return res.status(503).json({ error: 'auth_unavailable' })

  try {
    const { store, stats } = await getBackend()
    const api = createAdminApi({ store, stats, rootEmails: parseRootEmails(process.env.ROOT_EMAILS) })
    const out = await api({ method: req.method, action: String(req.query?.action || ''), headers: req.headers, query: { days: req.query?.days } })
    return res.status(out.status).json(out.body)
  } catch (e) {
    console.error('[admin]', e?.message)
    return res.status(503).json({ error: 'auth_unavailable' })
  }
}
