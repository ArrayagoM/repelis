import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryMail } from '../_lib/mailStore.js'
import { verifySvix, signSvix, handleEvent, resendBodyFetcher } from '../_lib/mailWebhook.js'
import { createMailer } from '../_lib/mailer.js'
import { createAdminApi } from '../_lib/adminApi.js'
import { createMemoryStore } from '../_lib/stores.js'
import { sha256 } from '../_lib/passwords.js'

const SECRET = `whsec_${Buffer.from('clave-de-prueba-0123456789abcdef').toString('base64')}`
const NOW = 1_800_000_000_000
const ROOT = 'fundador@mail.com'

describe('firma del webhook (Svix)', () => {
  const body = JSON.stringify({ type: 'email.received', data: { email_id: 'e1' } })
  const mk = (over = {}) => {
    const id = 'msg_1', timestamp = String(Math.floor(NOW / 1000))
    return { secret: SECRET, id, timestamp, body, signature: signSvix({ secret: SECRET, id, timestamp, body }), now: NOW, ...over }
  }
  it('acepta una firma válida (y una lista con varias firmas)', () => {
    expect(verifySvix(mk())).toEqual({ ok: true })
    const p = mk()
    expect(verifySvix({ ...p, signature: `v1,AAAA ${p.signature}` })).toEqual({ ok: true })
  })
  it('rechaza cuerpo alterado, firma ajena, secreto ajeno y datos faltantes', () => {
    expect(verifySvix(mk({ body: body + ' ' })).reason).toBe('signature')
    expect(verifySvix(mk({ signature: 'v1,AAAA' })).ok).toBe(false)
    expect(verifySvix(mk({ secret: `whsec_${Buffer.from('otra-clave-cualquiera-xxxxxxxxxxx').toString('base64')}` })).ok).toBe(false)
    expect(verifySvix(mk({ signature: undefined })).reason).toBe('missing')
    expect(verifySvix(mk({ secret: '' })).reason).toBe('missing')
    expect(verifySvix(mk({ signature: 'v2,xxxx' })).ok).toBe(false)
  })
  it('rechaza pedidos viejos o del futuro (anti-reenvío)', () => {
    expect(verifySvix(mk({ now: NOW + 6 * 60_000 })).reason).toBe('timestamp')
    expect(verifySvix(mk({ now: NOW - 6 * 60_000 })).reason).toBe('timestamp')
    expect(verifySvix(mk({ timestamp: 'abc' })).reason).toBe('timestamp')
  })
})

describe('eventos de Resend', () => {
  let mail
  beforeEach(() => { mail = createMemoryMail() })
  const received = (over = {}) => ({ type: 'email.received', created_at: '2026-10-07T12:00:00.000Z', data: { email_id: 'in_1', from: 'Ana <ana@gmail.com>', to: ['info@lifehigh.site'], subject: 'Consulta', message_id: '<m1@x>', attachments: [{ filename: 'a.pdf', content_type: 'application/pdf', size: 1200 }], ...over } })

  it('guarda el mail recibido con remitente, asunto, texto y adjuntos', async () => {
    const r = await handleEvent(received(), { mail, fetchBody: async () => ({ text: 'Hola, quería consultar algo', html: '<p>Hola</p>' }) })
    expect(r).toEqual({ handled: true, created: true })
    const [row] = await mail.list({ dir: 'in' })
    expect(row).toMatchObject({ dir: 'in', from: 'Ana <ana@gmail.com>', to: ['info@lifehigh.site'], subject: 'Consulta', preview: 'Hola, quería consultar algo', hasBody: true })
    expect(row.attachments).toEqual([{ name: 'a.pdf', type: 'application/pdf', size: 1200 }])
    expect((await mail.get(row.id)).html).toBe('<p>Hola</p>')
    expect(await mail.unreadCount()).toBe(1)
  })
  it('un reintento del mismo mail no lo duplica', async () => {
    await handleEvent(received(), { mail }); const again = await handleEvent(received(), { mail })
    expect(again).toEqual({ handled: true, created: false })
    expect((await mail.list({ dir: 'in' })).length).toBe(1)
  })
  it('si no se puede traer el cuerpo igual guarda quién escribió', async () => {
    await handleEvent(received({ email_id: 'in_2' }), { mail, fetchBody: async () => { throw new Error('403') } })
    const [row] = await mail.list({ dir: 'in' })
    expect(row).toMatchObject({ subject: 'Consulta', hasBody: false })
  })
  it('acota textos enormes y datos raros', async () => {
    await handleEvent(received({ email_id: 'in_3', subject: '', from: undefined, to: 'solo@x.com', attachments: Array.from({ length: 30 }, (_, i) => ({ filename: `f${i}` })) }), { mail, fetchBody: async () => ({ text: 'x'.repeat(50_000) }) })
    const row = (await mail.list({ dir: 'in' }))[0]
    expect(row.subject).toBe('(sin asunto)'); expect(row.to).toEqual(['solo@x.com']); expect(row.attachments).toHaveLength(10)
    expect((await mail.get(row.id)).text.length).toBe(20_000)
  })
  it('actualiza el estado de lo enviado (entregado, rebotó) y ignora eventos de aperturas', async () => {
    await mail.add({ dir: 'out', at: NOW, to: 'x@y.com', subject: 'Hola', kind: 'bienvenida', status: 'sent', resendId: 'out_1' })
    expect(await handleEvent({ type: 'email.delivered', data: { email_id: 'out_1' } }, { mail, now: NOW + 5 })).toEqual({ handled: true, updated: true })
    expect((await mail.list({ dir: 'out' }))[0]).toMatchObject({ status: 'delivered', statusAt: NOW + 5 })
    await handleEvent({ type: 'email.bounced', data: { email_id: 'out_1', bounce: { message: 'No existe' } } }, { mail })
    expect((await mail.list({ dir: 'out' }))[0]).toMatchObject({ status: 'bounced', detail: 'No existe' })
    expect((await handleEvent({ type: 'email.opened', data: { email_id: 'out_1' } }, { mail })).handled).toBe(false)
    expect(await handleEvent({ type: 'email.delivered', data: { email_id: 'desconocido' } }, { mail })).toEqual({ handled: true, updated: false })
    expect((await handleEvent({ type: 'algo.raro', data: {} }, { mail })).handled).toBe(false)
    expect((await handleEvent(null, { mail })).handled).toBe(false)
  })
  it('trae el cuerpo desde la API de Resend con la clave, y sin clave no lo intenta', async () => {
    const calls = []
    const f = resendBodyFetcher('re_x', async (u, init) => { calls.push({ u, auth: init.headers.Authorization }); return { ok: true, json: async () => ({ text: 'hola', html: '<b>hola</b>' }) } })
    expect(await f('in/1')).toEqual({ text: 'hola', html: '<b>hola</b>' })
    expect(calls[0]).toEqual({ u: 'https://api.resend.com/emails/receiving/in%2F1', auth: 'Bearer re_x' })
    expect(await resendBodyFetcher('', async () => { throw new Error('no debería llamar') })('x')).toBeNull()
    expect(await resendBodyFetcher('k', async () => ({ ok: false, status: 403 }))('x')).toBeNull()
  })
})

describe('el mailer registra cada envío', () => {
  it('anota destinatario, asunto, tipo y estado; nunca el cuerpo ni el token', async () => {
    const logged = []
    const m = createMailer({ RESEND_API_KEY: 'k' }, async () => ({ ok: true, status: 200, json: async () => ({ id: 're_123' }) }), { log: async (e) => logged.push(e) })
    await m.sendVerify('ana@mail.com', 'TOKEN-SECRETO', { name: 'Ana' })
    await m.sendWelcome('ana@mail.com', { name: 'Ana' })
    expect(logged.map((e) => [e.kind, e.status, e.resendId])).toEqual([['verificar', 'sent', 're_123'], ['bienvenida', 'sent', 're_123']])
    expect(logged[0]).toMatchObject({ dir: 'out', to: 'ana@mail.com', subject: expect.stringContaining('Confirmá') })
    expect(JSON.stringify(logged)).not.toMatch(/TOKEN-SECRETO|<html|href=/)
  })
  it('si falla el envío queda anotado como fallido y el error sigue subiendo', async () => {
    const logged = []
    const m = createMailer({ RESEND_API_KEY: 'k' }, async () => ({ ok: false, status: 422 }), { log: async (e) => logged.push(e) })
    await expect(m.sendReset('x@y.com', 't')).rejects.toThrow('mail_failed_422')
    expect(logged[0]).toMatchObject({ kind: 'restablecer', status: 'failed', detail: 'http_422' })
  })
  it('un fallo del registro no rompe el envío', async () => {
    const m = createMailer({ RESEND_API_KEY: 'k' }, async () => ({ ok: true, status: 200 }), { log: async () => { throw new Error('db caída') } })
    await expect(m.sendWelcome('a@b.com', {})).resolves.toBeUndefined()
  })
})

describe('bandeja en el panel del fundador', () => {
  let store, mail, api, n
  const mkUser = async (email) => {
    n += 1
    const user = await store.createUser({ email, name: 'U', emailVerified: true, createdAt: NOW - 86_400_000, library: {} })
    const token = `tok-${user.id}`
    await store.createSession({ id: sha256(token), userId: user.id, ua: '', createdAt: NOW, expiresAt: NOW + 400 * 86_400_000 })
    return { 'content-type': 'application/json', host: 'lifehigh.test', cookie: `lh_session=${token}` }
  }
  const stats = { getDailies: async () => [], getTitles: async () => [], listOnline: async () => [] }
  beforeEach(() => { store = createMemoryStore(); mail = createMemoryMail(); n = 0; api = createAdminApi({ store, stats, mail, rootEmails: [ROOT], now: () => NOW }) })

  it('solo el fundador la ve; para los demás no existe', async () => {
    const user = await mkUser('otro@mail.com')
    expect([401, 404]).toContain((await api({ method: 'GET', action: 'mail', headers: { host: 'x' }, query: {} })).status)
    expect((await api({ method: 'GET', action: 'mail', headers: user, query: {} })).status).toBe(404)
    expect((await api({ method: 'POST', action: 'mail-delete', headers: user, body: { id: 'm1' } })).status).toBe(404)
  })

  it('lista recibidos y enviados, cuenta no leídos y marca leído al abrir', async () => {
    const root = await mkUser(ROOT)
    await mail.add({ dir: 'in', at: NOW - 1000, from: 'a@x.com', to: ['info@lifehigh.site'], subject: 'Uno', text: 'texto 1' })
    const second = await mail.add({ dir: 'in', at: NOW - 500, from: 'b@x.com', to: ['info@lifehigh.site'], subject: 'Dos', text: 'texto 2', html: '<p>2</p>' })
    await mail.add({ dir: 'out', at: NOW - 100, to: 'c@x.com', subject: 'Salió', kind: 'bienvenida', status: 'sent' })
    const inbox = (await api({ method: 'GET', action: 'mail', headers: root, query: { dir: 'in' } })).body
    expect(inbox.items.map((i) => i.subject)).toEqual(['Dos', 'Uno'])                        // lo más nuevo primero
    expect(inbox.unread).toBe(2)
    expect(JSON.stringify(inbox.items)).not.toMatch(/<p>2<\/p>/)                              // la lista no trae el HTML
    const sent = (await api({ method: 'GET', action: 'mail', headers: root, query: { dir: 'out' } })).body
    expect(sent.items).toHaveLength(1); expect(sent.items[0]).toMatchObject({ to: 'c@x.com', kind: 'bienvenida' })
    const item = (await api({ method: 'GET', action: 'mail-item', headers: root, query: { id: second.id } })).body.item
    expect(item).toMatchObject({ subject: 'Dos', text: 'texto 2', html: '<p>2</p>' })
    expect((await api({ method: 'GET', action: 'mail', headers: root, query: { dir: 'in' } })).body.unread).toBe(1)
    expect((await api({ method: 'GET', action: 'mail-item', headers: root, query: { id: 'zzz' } })).status).toBe(404)
  })

  it('pagina y borra spam', async () => {
    const root = await mkUser(ROOT)
    for (let i = 0; i < 5; i++) await mail.add({ dir: 'in', at: NOW - i * 1000, from: `s${i}@x.com`, to: [], subject: `S${i}`, text: '' })
    const p1 = (await api({ method: 'GET', action: 'mail', headers: root, query: { dir: 'in', limit: 2 } })).body
    expect(p1.items).toHaveLength(2); expect(p1.hasMore).toBe(true)
    const p2 = (await api({ method: 'GET', action: 'mail', headers: root, query: { dir: 'in', limit: 10, before: p1.items.at(-1).at } })).body
    expect(p2.items.map((i) => i.subject)).toEqual(['S2', 'S3', 'S4'])
    expect((await api({ method: 'POST', action: 'mail-delete', headers: root, body: { id: p1.items[0].id } })).status).toBe(200)
    expect((await api({ method: 'POST', action: 'mail-delete', headers: root, body: { id: p1.items[0].id } })).status).toBe(404)
    expect((await api({ method: 'POST', action: 'mail-delete', headers: { ...root, 'content-type': 'text/plain' }, body: { id: 'x' } })).status).toBe(415)
  })

  it('limpia los mails de más de 6 meses', async () => {
    await mail.add({ dir: 'out', at: NOW - 200 * 86_400_000, to: 'v@x.com', subject: 'Viejo', kind: 'otro', status: 'sent' })
    await mail.add({ dir: 'out', at: NOW - 1000, to: 'n@x.com', subject: 'Nuevo', kind: 'otro', status: 'sent' })
    expect(await mail.prune(NOW - 180 * 86_400_000)).toBe(1)
    expect((await mail.list({ dir: 'out' })).map((m) => m.subject)).toEqual(['Nuevo'])
  })
})
