// Webhook de Resend → /api/mail/webhook
// Resend avisa cuando LLEGA un mail a info@lifehigh.site (event email.received) y cómo le fue a cada envío (entregado, rebotó…).
// Solo acepta pedidos con firma válida (RESEND_WEBHOOK_SECRET). Los mails se leen desde /panel (solo el fundador).
import { verifySvix, handleEvent, resendBodyFetcher } from '../_lib/mailWebhook.js'
import { getBackend } from '../_lib/stores.js'

export const config = { api: { bodyParser: false } }     // la firma se calcula sobre el cuerpo EXACTO: no se puede reformatear

const MAX_BODY = 512 * 1024

const readRaw = (req) => new Promise((resolve, reject) => {
  const chunks = []
  let size = 0
  req.on('data', (c) => { size += c.length; if (size > MAX_BODY) { reject(new Error('too_large')); req.destroy() } else chunks.push(c) })
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  req.on('error', reject)
})

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (String(req.query?.action) !== 'webhook' || req.method !== 'POST') return res.status(404).json({ error: 'not_found' })
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret || !process.env.MONGODB_URI) return res.status(503).json({ error: 'unavailable' })

  let body
  try { body = await readRaw(req) } catch { return res.status(413).json({ error: 'too_large' }) }
  const v = verifySvix({
    secret, body, id: req.headers['svix-id'], timestamp: req.headers['svix-timestamp'], signature: req.headers['svix-signature'],
  })
  if (!v.ok) return res.status(401).json({ error: 'bad_signature' })

  let event
  try { event = JSON.parse(body) } catch { return res.status(400).json({ error: 'bad_json' }) }
  try {
    const { mail } = await getBackend()
    const out = await handleEvent(event, { mail, fetchBody: resendBodyFetcher(process.env.RESEND_READ_KEY || process.env.RESEND_API_KEY) })
    return res.status(200).json({ ok: true, ...out })
  } catch (e) {
    console.error('[mail-webhook]', e?.message)
    return res.status(500).json({ error: 'server_error' })          // Resend reintenta
  }
}
