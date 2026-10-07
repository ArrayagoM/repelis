// Tarea programada (vercel.json → crons): resumen diario por mail. Vercel la llama con
// "Authorization: Bearer <CRON_SECRET>" si CRON_SECRET está definida; sin ella, no corre (nadie más puede dispararla).
import { runDigest } from '../_lib/digest.js'
import { createMailer } from '../_lib/mailer.js'
import { getBackend } from '../_lib/stores.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'unauthorized' })
  if (!process.env.MONGODB_URI) return res.status(503).json({ error: 'unavailable' })
  try {
    const { store, social, mail } = await getBackend()
    const mailer = createMailer(process.env, fetch, { log: (m) => mail.add(m) })
    await mail.prune(Date.now() - 180 * 86_400_000)                    // la bandeja guarda 6 meses
    const out = await runDigest({ store, social, mailer, site: mailer?.site })
    return res.status(200).json({ ok: true, ...out })
  } catch (e) {
    console.error('[digest]', e?.message)
    return res.status(500).json({ error: 'server_error' })
  }
}
