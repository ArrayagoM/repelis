import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WebSocket } from 'ws'
import { createVoiceServer } from '../../voice-server/server.js'
import { signToken, verifyToken, safeEqual, originAllowed, makeLimiter, parseIceServers, MAX_PEERS } from '../../voice-server/lib.js'
import { createVoice } from '../_lib/voice.js'
import { createRoomsApi } from '../_lib/roomsApi.js'
import { createMemoryRooms } from '../_lib/roomsStore.js'
import { createMemoryStore } from '../_lib/stores.js'
import { createMemorySocial } from '../_lib/socialStore.js'
import { sha256 } from '../_lib/passwords.js'

const SECRET = 'x'.repeat(32)
const CODE = 'abc2345'
const ORIGIN = 'https://lifehigh.site'

describe('tokens de voz', () => {
  const claims = { sub: '7', handle: 'ana', name: 'Ana', code: CODE }
  it('firma y verifica; vence a los 5 minutos', () => {
    const now = 1_800_000_000_000
    const t = signToken(claims, SECRET, now)
    expect(verifyToken(t, SECRET, now + 1000)).toMatchObject({ ok: true, claims: { sub: '7', code: CODE } })
    expect(verifyToken(t, SECRET, now + 301_000)).toEqual({ ok: false, reason: 'expired' })
  })
  it('rechaza firmas ajenas, alteradas y basura', () => {
    const t = signToken(claims, SECRET)
    expect(verifyToken(t, 'otro-secreto-distinto-largo-123456').ok).toBe(false)
    const [h, b, s] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ ...claims, sub: '1', exp: 9_999_999_999 })).toString('base64url')
    expect(verifyToken(`${h}.${forged}.${s}`, SECRET).ok).toBe(false)
    for (const bad of ['', 'a.b', 'a.b.c', null, undefined, 'x'.repeat(3000), `${h}.${b}.`]) expect(verifyToken(bad, SECRET).ok).toBe(false)
    expect(verifyToken(t, '').ok).toBe(false)
  })
  it('rechaza algoritmos distintos de HS256 y códigos de sala inválidos', () => {
    const none = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...claims, exp: 9_999_999_999 })).toString('base64url')}.`
    expect(verifyToken(none, SECRET).ok).toBe(false)
    expect(verifyToken(signToken({ ...claims, code: '../etc' }, SECRET), SECRET)).toEqual({ ok: false, reason: 'bad_claims' })
  })
  it('utilidades: comparación segura, orígenes, límite por ventana, ICE', () => {
    expect(safeEqual('abc', 'abc')).toBe(true); expect(safeEqual('abc', 'abd')).toBe(false); expect(safeEqual('abc', 'abcd')).toBe(false); expect(safeEqual(undefined, 'x')).toBe(false)
    expect(originAllowed(ORIGIN, [ORIGIN])).toBe(true); expect(originAllowed('https://malo.com', [ORIGIN])).toBe(false); expect(originAllowed(undefined, [ORIGIN])).toBe(false)
    const lim = makeLimiter(3, 1000)
    expect([lim(0), lim(1), lim(2), lim(3)]).toEqual([true, true, true, false])
    expect(lim(1500)).toBe(true)
    expect(parseIceServers('')).toHaveLength(2); expect(parseIceServers('{no json')).toHaveLength(2)
    expect(parseIceServers('[{"urls":"turn:t:3478","username":"u","credential":"c"}]')[0].urls).toBe('turn:t:3478')
  })
})

describe('servidor de voz (WebSocket real)', () => {
  let srv, port
  const open = (token, origin = ORIGIN) => new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`, { headers: origin ? { Origin: origin } : {} })
    const msgs = []
    const waiters = []
    ws.on('message', (d) => { const m = JSON.parse(d.toString()); msgs.push(m); waiters.splice(0).forEach((w) => w()) })
    ws.next = async (type, ms = 2000) => {
      const end = Date.now() + ms
      for (;;) {
        const i = msgs.findIndex((m) => m.type === type)
        if (i >= 0) return msgs.splice(i, 1)[0]
        if (Date.now() > end) throw new Error(`no llegó ${type}`)
        await new Promise((r) => { waiters.push(r); setTimeout(r, 50) })
      }
    }
    ws.msgs = msgs
    ws.closed = new Promise((r) => ws.on('close', (code, reason) => r({ code, reason: reason.toString() })))
    ws.on('open', () => resolve(ws))
    ws.on('unexpected-response', (_req, res) => resolve({ rejected: res.statusCode }))
    ws.on('error', () => {})
  })
  const tok = (sub, handle, code = CODE) => signToken({ sub, handle, name: handle.toUpperCase(), code }, SECRET)
  const openMany = []
  const track = async (...a) => { const w = await open(...a); if (w.close) openMany.push(w); return w }

  beforeEach(async () => {
    srv = createVoiceServer({ secret: SECRET, origins: ORIGIN })
    await new Promise((r) => srv.server.listen(0, '127.0.0.1', r))
    port = srv.server.address().port
  })
  afterEach(async () => {
    openMany.splice(0).forEach((w) => { try { w.terminate() } catch { /* cerrado */ } })
    for (const c of srv.wss.clients) c.terminate()
    await new Promise((r) => srv.server.close(r))
  })

  it('rechaza sin token, con token malo y desde otro origen', async () => {
    expect((await open('')).rejected).toBe(401)
    expect((await open(signToken({ sub: '1', code: CODE }, 'otro-secreto-distinto-largo-123456'))).rejected).toBe(401)
    expect((await open(tok('1', 'ana'), 'https://malo.com')).rejected).toBe(403)
    expect((await open(tok('1', 'ana'), '')).rejected).toBe(403)
  })

  it('bienvenida con la lista de presentes y aviso a los demás', async () => {
    const a = await track(tok('1', 'ana'))
    const wa = await a.next('welcome')
    expect(wa.peers).toEqual([]); expect(wa.ice.length).toBeGreaterThan(0); expect(wa.id).toBeTruthy()
    const b = await track(tok('2', 'bea'))
    const wb = await b.next('welcome')
    expect(wb.peers).toEqual([{ id: wa.id, handle: 'ana', name: 'ANA', muted: false }])
    const joined = await a.next('peer-joined')
    expect(joined.peer).toMatchObject({ id: wb.id, handle: 'bea' })
  })

  it('reenvía la señalización solo a la persona indicada y avisa mute y salida', async () => {
    const a = await track(tok('1', 'ana')), b = await track(tok('2', 'bea')), c = await track(tok('3', 'cami'))
    const [wa, wb] = [await a.next('welcome'), await b.next('welcome')]; await c.next('welcome')
    b.send(JSON.stringify({ type: 'signal', to: wa.id, data: { sdp: 'offer-x' } }))
    expect(await a.next('signal')).toEqual({ type: 'signal', from: wb.id, data: { sdp: 'offer-x' } })
    await new Promise((r) => setTimeout(r, 150))
    expect(c.msgs.some((m) => m.type === 'signal')).toBe(false)               // cami no ve lo de ana y bea
    b.send(JSON.stringify({ type: 'mute', muted: true }))
    expect(await a.next('peer-state')).toMatchObject({ id: wb.id, muted: true })
    b.close()
    expect((await a.next('peer-left')).id).toBe(wb.id)
  })

  it('las salas están aisladas entre sí', async () => {
    const a = await track(tok('1', 'ana', 'abc2345')), b = await track(tok('2', 'bea', 'zzz9999'))
    await a.next('welcome'); const wb = await b.next('welcome')
    expect(wb.peers).toEqual([])
    a.send(JSON.stringify({ type: 'signal', to: wb.id, data: 'x' }))
    await new Promise((r) => setTimeout(r, 150))
    expect(b.msgs.some((m) => m.type === 'signal')).toBe(false)
  })

  it('una persona = una conexión: la nueva reemplaza a la vieja', async () => {
    const a1 = await track(tok('1', 'ana'))
    await a1.next('welcome')
    const a2 = await track(tok('1', 'ana'))
    await a2.next('welcome')
    expect((await a1.closed).code).toBe(4002)
    expect(srv.rooms.size(CODE)).toBe(1)
  })

  it('no entra más gente que el máximo', async () => {
    for (let i = 0; i < MAX_PEERS; i++) { const w = await track(tok(String(i + 10), `u${i}x`)); await w.next('welcome') }
    const extra = await track(tok('999', 'sobra'))
    expect((await extra.closed).code).toBe(4001)
  })

  it('corta a quien manda demasiado rápido y descarta basura sin caerse', async () => {
    const a = await track(tok('1', 'ana'))
    await a.next('welcome')
    a.send('esto no es json'); a.send(JSON.stringify([1, 2])); a.send(JSON.stringify({ type: 'desconocido' }))
    await new Promise((r) => setTimeout(r, 100))
    expect(a.readyState).toBe(1)
    for (let i = 0; i < 130; i++) a.send(JSON.stringify({ type: 'signal', to: 'nadie', data: i }))
    expect((await a.closed).code).toBe(4008)
  })

  it('/kick exige el secreto y corta a esa persona (o a toda la sala)', async () => {
    const a = await track(tok('1', 'ana')), b = await track(tok('2', 'bea'))
    await a.next('welcome'); await b.next('welcome')
    const url = `http://127.0.0.1:${port}/kick`
    const post = (secret, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(secret ? { 'x-voice-secret': secret } : {}) }, body: JSON.stringify(body) })
    expect((await post(null, { code: CODE, userId: '2' })).status).toBe(401)
    expect((await post('mal-secreto', { code: CODE, userId: '2' })).status).toBe(401)
    expect(await (await post(SECRET, { code: CODE, userId: '2' })).json()).toEqual({ ok: true, closed: 1 })
    expect((await b.closed).code).toBe(4003)
    expect(a.readyState).toBe(1)
    expect(await (await post(SECRET, { code: CODE, all: true })).json()).toEqual({ ok: true, closed: 1 })
    expect((await a.closed).code).toBe(4003)
  })

  it('/health responde sin datos sensibles y rutas desconocidas dan 404', async () => {
    const h = await (await fetch(`http://127.0.0.1:${port}/health`)).json()
    expect(h).toEqual({ ok: true, rooms: 0 })
    expect((await fetch(`http://127.0.0.1:${port}/otra`)).status).toBe(404)
  })

  it('no arranca sin secreto', () => { expect(() => createVoiceServer({ secret: '' })).toThrow() })
})

describe('puente de la API hacia el servidor de voz', () => {
  it('sin variables no hay voz; con variables firma tokens y arma la URL', () => {
    expect(createVoice({})).toBeNull()
    expect(createVoice({ VOICE_URL: 'wss://v.example.com', VOICE_SECRET: 'corto' })).toBeNull()
    expect(createVoice({ VOICE_URL: 'https://v.example.com', VOICE_SECRET: SECRET })).toBeNull()
    const v = createVoice({ VOICE_URL: 'wss://v.example.com/', VOICE_SECRET: SECRET })
    expect(v.url).toBe('wss://v.example.com/ws')
    expect(verifyToken(v.token({ userId: 5, handle: 'ana', name: 'Ana', code: CODE }), SECRET)).toMatchObject({ ok: true, claims: { sub: '5', handle: 'ana' } })
  })
  it('warm y kick llaman al servidor por HTTP con el secreto y no explotan si no responde', async () => {
    const calls = []
    const fetchImpl = async (u, init) => { calls.push({ u, init }); return { ok: true } }
    const v = createVoice({ VOICE_URL: 'wss://v.example.com', VOICE_SECRET: SECRET }, fetchImpl)
    await v.warm(); await v.kick({ code: CODE, userId: '9' })
    expect(calls[0].u).toBe('https://v.example.com/health')
    expect(calls[1].u).toBe('https://v.example.com/kick')
    expect(calls[1].init.headers['x-voice-secret']).toBe(SECRET)
    expect(JSON.parse(calls[1].init.body)).toEqual({ code: CODE, userId: '9', all: false })
    const down = createVoice({ VOICE_URL: 'wss://v.example.com', VOICE_SECRET: SECRET }, async () => { throw new Error('dormido') })
    await expect(down.warm()).resolves.toBeNull()
  })
})

describe('API de salas con voz', () => {
  const T0 = Date.UTC(2026, 9, 20, 22, 0, 0)
  let store, social, rooms, api, n, calls, clock
  const H = { 'content-type': 'application/json', host: 'lifehigh.test' }
  const mk = async (handle) => {
    n += 1
    const user = await store.createUser({ email: `u${n}@mail.com`, name: `U${n}`, emailVerified: true, createdAt: T0 - 7 * 86400000, library: {} })
    const token = `tok-${user.id}`
    await store.createSession({ id: sha256(token), userId: user.id, ua: '', createdAt: clock, expiresAt: clock + 400 * 86400000 })
    await social.createProfile({ userId: user.id, handle, name: user.name, bio: '', createdAt: clock, handleChangedAt: 0 })
    return { user, h: { ...H, cookie: `lh_session=${token}` } }
  }
  const post = (action, body, h) => api({ method: 'POST', action, headers: h, body })

  beforeEach(() => {
    store = createMemoryStore(); social = createMemorySocial(); rooms = createMemoryRooms(); n = 0; clock = T0; calls = []
    const voice = createVoice({ VOICE_URL: 'wss://v.example.com', VOICE_SECRET: SECRET }, async (u, init) => { calls.push({ u, body: init?.body ? JSON.parse(init.body) : null }); return { ok: true } })
    api = createRoomsApi({ store, social, rooms, voice, now: () => clock })
  })

  it('crear una sala despierta el servidor de voz; la ficha avisa que hay voz', async () => {
    const ana = await mk('ana')
    const r = await post('create', { title: 'Cine' }, ana.h)
    expect(r.body.room.voice).toEqual({ available: true })
    expect(calls.some((c) => c.u.endsWith('/health'))).toBe(true)
  })

  it('una sala para dentro de horas no lo despierta todavía', async () => {
    const ana = await mk('ana')
    await post('create', { title: 'Cine', startsAt: T0 + 5 * 3_600_000 }, ana.h)
    expect(calls).toHaveLength(0)
  })

  it('el token de voz es solo para quienes están dentro y no fueron sacados', async () => {
    const ana = await mk('ana'), bea = await mk('bea')
    const { code } = (await post('create', { title: 'Cine' }, ana.h)).body.room
    expect((await post('voice-token', { code }, H)).status).toBe(401)
    expect((await post('voice-token', { code }, bea.h)).body.error).toBe('not_member')
    await post('join', { code }, bea.h)
    const t = await post('voice-token', { code }, bea.h)
    expect(t.status).toBe(200)
    expect(t.body.url).toBe('wss://v.example.com/ws')
    expect(verifyToken(t.body.token, SECRET)).toMatchObject({ ok: true, claims: { handle: 'bea', code } })
    await post('kick', { code, handle: 'bea' }, ana.h)
    expect(calls.some((c) => c.u.endsWith('/kick') && c.body.code === code && c.body.userId === bea.user.id)).toBe(true)
    expect((await post('voice-token', { code }, bea.h)).body.error).toBe('kicked')
  })

  it('cerrar la sala corta la voz de todos y ya no se dan tokens', async () => {
    const ana = await mk('ana')
    const { code } = (await post('create', { title: 'Cine' }, ana.h)).body.room
    await post('close', { code }, ana.h)
    expect(calls.some((c) => c.u.endsWith('/kick') && c.body.all === true)).toBe(true)
    expect((await post('voice-token', { code }, ana.h)).status).toBe(410)
  })

  it('sin servidor de voz configurado, la API lo dice y el resto sigue', async () => {
    api = createRoomsApi({ store, social, rooms, voice: null, now: () => clock })
    const ana = await mk('ana')
    const r = await post('create', { title: 'Cine' }, ana.h)
    expect(r.body.room.voice).toEqual({ available: false })
    expect((await post('voice-token', { code: r.body.room.code }, ana.h)).status).toBe(503)
  })
})
