import { describe, it, expect, beforeEach } from 'vitest'
import { createSocialApi } from '../_lib/socialApi.js'
import { createPush } from '../_lib/push.js'
import { createMemoryStore } from '../_lib/stores.js'
import { createMemorySocial } from '../_lib/socialStore.js'
import { sha256 } from '../_lib/passwords.js'

const T0 = Date.UTC(2026, 9, 6, 15, 0, 0)
let store, social, clock, api, n, sent, pushImpl

const H = { 'content-type': 'application/json', host: 'lifehigh.test' }
const mkUser = async (over = {}) => {
  n += 1
  const user = await store.createUser({ email: `u${n}@mail.com`, name: `Usuario ${n}`, emailVerified: true, createdAt: T0 - 7 * 86400000, library: {}, ...over })
  const token = `tok-${user.id}`
  await store.createSession({ id: sha256(token), userId: user.id, ua: '', createdAt: clock, expiresAt: clock + 400 * 86400000 })
  return { user, h: { ...H, cookie: `lh_session=${token}` } }
}
const get = (action, query = {}, h = { host: 'lifehigh.test' }) => api({ method: 'GET', action, headers: h, query })
const post = (action, body, h) => api({ method: 'POST', action, headers: h, body })
const withProfile = async (handle) => { const u = await mkUser(); expect((await post('profile', { handle }, u.h)).status).toBe(200); return u }
const mkList = async (u, over = {}) => (await post('list', { title: 'Plan de finde', tag: 'finde', visibility: 'public', items: [{ type: 'movie', id: 1, title: 'Peli' }], ...over }, u.h)).body.list.id
const SUB = (i = 1) => ({ subscription: { endpoint: `https://push.example.com/send/abc${i}abcdefghij`, keys: { p256dh: 'p256-key', auth: 'auth-key' } } })

beforeEach(() => {
  store = createMemoryStore(); social = createMemorySocial(); clock = T0; n = 0; sent = []
  const webpush = {
    setVapidDetails() {},
    sendNotification: async (sub, body) => { if (pushImpl) await pushImpl(sub); sent.push({ endpoint: sub.endpoint, body: JSON.parse(body) }) },
  }
  pushImpl = null
  api = createSocialApi({ store, social, push: createPush({ webpush, publicKey: 'PUB', privateKey: 'PRIV' }), now: () => clock })
})

describe('avisos dentro de la app', () => {
  it('seguir, dar me gusta y comentar generan avisos para la dueña (nunca para uno mismo)', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    const id = await mkList(ana)
    await post('follow', { handle: 'ana', on: true }, bea.h)
    await post('like', { id, on: true }, bea.h)
    await post('comment', { target: `list:${id}`, text: '¡Qué buena lista!' }, bea.h)
    await post('like', { id, on: true }, ana.h)                        // ella misma: sin aviso

    const r = await get('notifications', {}, ana.h)
    expect(r.body.unread).toBe(3)
    expect(r.body.items.map((i) => i.type).sort()).toEqual(['comment', 'follow', 'like'])
    expect(r.body.items.find((i) => i.type === 'follow')).toMatchObject({ text: '@bea empezó a seguirte', link: '/u/bea', read: false })
    expect((await get('notifications', {}, bea.h)).body.unread).toBe(0)
  })

  it('no repite avisos: seguir/dejar/seguir y like/quitar/like cuentan una sola vez', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    const id = await mkList(ana)
    for (let i = 0; i < 3; i++) {
      await post('follow', { handle: 'ana', on: true }, bea.h); await post('follow', { handle: 'ana', on: false }, bea.h)
      await post('like', { id, on: true }, bea.h); await post('like', { id, on: false }, bea.h)
    }
    expect((await get('notifications', {}, ana.h)).body.unread).toBe(2)
  })

  it('una lista nueva avisa a quienes siguen a la autora (pública y con títulos)', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea'), cami = await withProfile('cami')
    await post('follow', { handle: 'ana', on: true }, bea.h)
    const id = await mkList(ana, { title: 'Maratón de terror' })
    const b = await get('notifications', {}, bea.h)
    expect(b.body.items.find((i) => i.type === 'new_list')).toMatchObject({ text: '@ana publicó una lista nueva: «Maratón de terror»', link: `/lista/${id}` })
    expect((await get('notifications', {}, cami.h)).body.unread).toBe(0)       // no la sigue
    await mkList(ana, { title: 'Privada', visibility: 'private' }).catch(() => {})
  })

  it('marcar como leídos pone el contador en cero; /unread es liviano y sin sesión da 0', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    await post('follow', { handle: 'ana', on: true }, bea.h)
    expect((await get('unread', {}, ana.h)).body.unread).toBe(1)
    expect((await get('unread')).body.unread).toBe(0)
    await post('notifications-read', {}, ana.h)
    expect((await get('unread', {}, ana.h)).body.unread).toBe(0)
    expect((await get('notifications', {}, ana.h)).body.items[0].read).toBe(true)
  })

  it('exige sesión y no mezcla avisos de otras personas', async () => {
    expect((await get('notifications')).status).toBe(401)
    expect((await post('notifications-read', {}, H)).status).toBe(401)
  })

  it('borrar la cuenta borra sus avisos y los que ella generó', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    await post('follow', { handle: 'ana', on: true }, bea.h)
    await social.deleteUserData(bea.user.id)
    expect((await get('notifications', {}, ana.h)).body.items).toHaveLength(0)
  })
})

describe('push', () => {
  it('suscribirse valida el formato y exige sesión', async () => {
    const ana = await withProfile('ana')
    expect((await post('push-subscribe', SUB(), H)).status).toBe(401)
    for (const bad of [{}, { subscription: null }, { subscription: { endpoint: 'http://inseguro.com/x', keys: { p256dh: 'a', auth: 'b' } } }, { subscription: { endpoint: SUB().subscription.endpoint, keys: {} } }, { subscription: { endpoint: 'x'.repeat(600), keys: { p256dh: 'a', auth: 'b' } } }]) {
      expect((await post('push-subscribe', bad, ana.h)).status).toBe(400)
    }
    expect((await post('push-subscribe', SUB(), ana.h)).body.subscribed).toBe(true)
    expect((await get('notifications', {}, ana.h)).body.push).toMatchObject({ available: true, publicKey: 'PUB', devices: 1 })
  })

  it('manda el push con texto y enlace cuando alguien te sigue', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    await post('push-subscribe', SUB(), ana.h)
    await post('follow', { handle: 'ana', on: true }, bea.h)
    expect(sent).toHaveLength(1)
    expect(sent[0].body).toMatchObject({ title: 'Life High', body: '@bea empezó a seguirte', url: '/u/bea' })
  })

  it('respeta la preferencia de apagar el push (el aviso dentro de la app sigue)', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    await post('push-subscribe', SUB(), ana.h)
    expect((await post('notify-prefs', { push: false }, ana.h)).body.prefs).toEqual({ push: false, email: false })
    await post('follow', { handle: 'ana', on: true }, bea.h)
    expect(sent).toHaveLength(0)
    expect((await get('notifications', {}, ana.h)).body.unread).toBe(1)
  })

  it('borra las suscripciones vencidas (410) y un fallo del servicio no rompe la acción', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea'), cami = await withProfile('cami')
    await post('push-subscribe', SUB(1), ana.h)
    pushImpl = async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }) }
    expect((await post('follow', { handle: 'ana', on: true }, bea.h)).status).toBe(200)
    expect(await social.pushSubsOf(ana.user.id)).toHaveLength(0)

    await post('push-subscribe', SUB(2), ana.h)
    pushImpl = async () => { throw new Error('timeout') }
    expect((await post('follow', { handle: 'ana', on: true }, cami.h)).status).toBe(200)
    expect(await social.pushSubsOf(ana.user.id)).toHaveLength(1)       // un error temporal no borra
  })

  it('sin claves VAPID el push queda deshabilitado pero la API sigue', async () => {
    api = createSocialApi({ store, social, push: null, now: () => clock })
    const ana = await withProfile('ana')
    expect((await post('push-subscribe', SUB(), ana.h)).status).toBe(503)
    expect((await get('notifications', {}, ana.h)).body.push).toMatchObject({ available: false, publicKey: null })
  })

  it('darse de baja quita solo la suscripción propia', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    await post('push-subscribe', SUB(1), ana.h)
    await post('push-unsubscribe', { endpoint: SUB(1).subscription.endpoint }, bea.h)       // otra persona: no borra
    expect(await social.pushSubsOf(ana.user.id)).toHaveLength(1)
    await post('push-unsubscribe', { endpoint: SUB(1).subscription.endpoint }, ana.h)
    expect(await social.pushSubsOf(ana.user.id)).toHaveLength(0)
  })

  it('el cuerpo del push recorta textos largos y solo acepta rutas internas', async () => {
    const calls = []
    const p = createPush({ webpush: { setVapidDetails() {}, sendNotification: async (_s, body) => { calls.push(JSON.parse(body)) } }, publicKey: 'a', privateKey: 'b' })
    await p.send([{ endpoint: 'https://x.example.com/aaaaaaaaaa', keys: {} }], { title: 'T'.repeat(200), body: 'B'.repeat(500), url: 'https://malo.com' })
    expect(calls[0].title.length).toBe(80)
    expect(calls[0].body.length).toBe(180)
    expect(calls[0].url).toBe('/')
  })
})
