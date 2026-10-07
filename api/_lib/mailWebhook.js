// Webhook de Resend: avisa cuando LLEGA un mail a info@lifehigh.site y cómo le fue a los que mandamos (entregado, rebotó…).
// La firma es de Svix (https://docs.svix.com/receiving/verifying-payloads/how-manual): sin firma válida no se hace nada.
import crypto from 'node:crypto'
import { MAX_TEXT, MAX_HTML } from './mailStore.js'

const TOLERANCE_S = 300

/**
 * @param {{ secret: string, id: string, timestamp: string, signature: string, body: string, now?: number }} p
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export const verifySvix = ({ secret, id, timestamp, signature, body, now = Date.now() }) => {
  if (!secret || !id || !timestamp || !signature || typeof body !== 'string') return { ok: false, reason: 'missing' }
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || Math.abs(now / 1000 - ts) > TOLERANCE_S) return { ok: false, reason: 'timestamp' }
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
  if (!key.length) return { ok: false, reason: 'secret' }
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest()
  for (const part of String(signature).split(' ')) {
    const [version, sig] = part.split(',')
    if (version !== 'v1' || !sig) continue
    let given
    try { given = Buffer.from(sig, 'base64') } catch { continue }
    if (given.length === expected.length && crypto.timingSafeEqual(given, expected)) return { ok: true }
  }
  return { ok: false, reason: 'signature' }
}

/** Firma un cuerpo como lo haría Svix (para las pruebas). */
export const signSvix = ({ secret, id, timestamp, body }) => {
  const key = Buffer.from(String(secret).replace(/^whsec_/, ''), 'base64')
  return `v1,${crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`
}

const str = (v, max) => String(v ?? '').slice(0, max)
const addr = (v) => str(Array.isArray(v) ? v[0] : v, 300)
const list = (v) => (Array.isArray(v) ? v : v ? [v] : []).map((x) => str(x, 300)).slice(0, 10)

const STATUS = { 'email.sent': 'sent', 'email.delivered': 'delivered', 'email.bounced': 'bounced', 'email.complained': 'complained', 'email.delivery_delayed': 'delayed', 'email.failed': 'failed', 'email.opened': null, 'email.clicked': null }

/**
 * Procesa un evento ya verificado.
 * @param {{ type: string, created_at?: string, data?: any }} event
 * @param {{ mail, fetchBody?: (emailId: string) => Promise<{ text?: string, html?: string } | null>, now?: number }} deps
 */
export const handleEvent = async (event, { mail, fetchBody = async () => null, now = Date.now() }) => {
  const type = String(event?.type || '')
  const d = event?.data || {}

  if (type === 'email.received') {
    const emailId = str(d.email_id || d.id, 100)
    if (!emailId) return { handled: false, reason: 'no_id' }
    const body = (await fetchBody(emailId).catch(() => null)) || {}
    const row = await mail.addOnce(`in:${emailId}`, {
      dir: 'in', at: Date.parse(d.created_at || event.created_at) || now, resendId: emailId,
      from: addr(d.from), to: list(d.to), cc: list(d.cc), subject: str(d.subject, 300) || '(sin asunto)',
      messageId: str(d.message_id, 300), text: str(body.text, MAX_TEXT), html: str(body.html, MAX_HTML),
      attachments: (Array.isArray(d.attachments) ? d.attachments : []).slice(0, 10).map((a) => ({ name: str(a.filename, 200), type: str(a.content_type, 100), size: Number(a.size) || 0 })),
    })
    return { handled: true, created: !!row }
  }

  if (type in STATUS) {
    const status = STATUS[type]
    if (!status) return { handled: false, reason: 'ignored' }
    const resendId = str(d.email_id || d.id, 100)
    const detail = type === 'email.bounced' ? str(d.bounce?.message || d.bounce?.type, 200) : undefined
    const found = resendId ? await mail.setStatusByResendId(resendId, status, now, detail) : false
    return { handled: true, updated: found }
  }
  return { handled: false, reason: 'unknown_type' }
}

/** Busca el cuerpo del mail recibido en la API de Resend (si la clave lo permite). */
export const resendBodyFetcher = (apiKey, fetchImpl = fetch) => async (emailId) => {
  if (!apiKey) return null
  const res = await fetchImpl(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${apiKey}` } })
  if (!res.ok) return null
  const j = await res.json()
  return { text: j.text || '', html: j.html || '' }
}
