// Recibe los "latidos" anónimos de la app (quién está conectado, qué mira, cuánto tiempo).
// Sin MONGODB_URI responde 204 y no hace nada. Lógica y validación en api/_lib/pulse.js.

import { createPulse } from './_lib/pulse.js'
import { getStats } from './_lib/stores.js'

// Límite por IP dentro de esta instancia (barato y sin base): frena ráfagas, no es una defensa absoluta
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 240
const hits = new Map()
const tooMany = (ip) => {
  const now = Date.now()
  const cur = hits.get(ip)
  if (!cur || cur.resetAt <= now) {
    if (hits.size > 5000) hits.clear()
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  cur.count += 1
  return cur.count > MAX_PER_WINDOW
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })
  if (!process.env.MONGODB_URI) return res.status(204).end()

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || ''
  if (tooMany(ip)) return res.status(429).json({ error: 'too_many_requests' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = null } }

  try {
    const stats = await getStats()
    const out = await createPulse({ stats })({ body, headers: req.headers })
    return res.status(out.status).json(out.body)
  } catch (e) {
    console.error('[pulse]', e?.message)
    return res.status(204).end()      // las estadísticas nunca deben romper la app
  }
}
