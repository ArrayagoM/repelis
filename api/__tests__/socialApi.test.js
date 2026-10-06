import { describe, it, expect, beforeEach } from 'vitest'
import { createSocialApi } from '../_lib/socialApi.js'
import { createMemoryStore } from '../_lib/stores.js'
import { createMemorySocial } from '../_lib/socialStore.js'
import { sha256 } from '../_lib/passwords.js'

const T0 = Date.UTC(2026, 9, 6, 15, 0, 0)
const ROOT = 'fundador@mail.com'
let store, social, clock, api, n

const H = { 'content-type': 'application/json', host: 'lifehigh.test' }

// Crea un usuario (verificado por defecto) con sesión; devuelve { user, h } listos para usar
const mkUser = async (over = {}) => {
  n += 1
  const user = await store.createUser({ email: `u${n}@mail.com`, name: `Usuario ${n}`, emailVerified: true, createdAt: T0 - 7 * 86400000, library: {}, ...over })
  const token = `tok-${user.id}`
  await store.createSession({ id: sha256(token), userId: user.id, ua: '', createdAt: clock, expiresAt: clock + 400 * 86400000 })
  return { user, h: { ...H, cookie: `lh_session=${token}` } }
}
const get = (action, query = {}, h = { host: 'lifehigh.test' }) => api({ method: 'GET', action, headers: h, query })
const post = (action, body, h) => api({ method: 'POST', action, headers: h, body })

const item = (id, over = {}) => ({ type: 'movie', id, title: `Peli ${id}`, poster: '/p.jpg', year: '2020', ...over })
const listBody = (over = {}) => ({ title: 'Plan de finde', description: 'Para ver con amigos', tag: 'finde', visibility: 'public', items: [item(1), item(2)], ...over })

// Usuario con perfil listo
const withProfile = async (handle, over = {}) => {
  const u = await mkUser(over)
  const r = await post('profile', { handle, bio: '' }, u.h)
  expect(r.status).toBe(200)
  return u
}

beforeEach(() => {
  store = createMemoryStore()
  social = createMemorySocial()
  clock = T0
  n = 0
  api = createSocialApi({ store, social, now: () => clock, rootEmails: [ROOT] })
})

describe('perfil', () => {
  it('un perfil inexistente o con formato inválido da 404', async () => {
    expect((await get('profile', { handle: 'nadie' })).status).toBe(404)
    expect((await get('profile', { handle: '<script>' })).status).toBe(404)
    expect((await get('profile', {})).status).toBe(404)
  })
  it('crear perfil requiere sesión, JSON y mismo origen', async () => {
    expect((await post('profile', { handle: 'ana' }, H)).status).toBe(401)
    const { h } = await mkUser()
    expect((await post('profile', { handle: 'ana' }, { ...h, 'content-type': 'text/plain' })).status).toBe(415)
    expect((await post('profile', { handle: 'ana' }, { ...h, origin: 'https://malo.com' })).status).toBe(403)
    expect((await post('profile', { handle: 'ana' }, { ...h, 'sec-fetch-site': 'cross-site' })).status).toBe(403)
  })
  it('una cuenta nueva sin mail verificado espera una hora para publicar', async () => {
    const { h } = await mkUser({ emailVerified: false, createdAt: clock - 5 * 60_000 })
    expect((await post('profile', { handle: 'ana' }, h)).body.error).toBe('cannot_publish_yet')
    clock += 61 * 60_000
    expect((await post('profile', { handle: 'ana' }, h)).status).toBe(200)
  })
  it('valida el @usuario: formato, reservados y repetidos', async () => {
    const a = await mkUser(); const b = await mkUser()
    expect((await post('profile', { handle: 'a' }, a.h)).body.error).toBe('handle_invalid')
    expect((await post('profile', { handle: 'ñandú' }, a.h)).body.error).toBe('handle_invalid')
    expect((await post('profile', { handle: 'admin' }, a.h)).body.error).toBe('handle_reserved')
    expect((await post('profile', { handle: '@Ana_23' }, a.h)).body.profile.handle).toBe('ana_23')
    const dup = await post('profile', { handle: 'ANA_23' }, b.h)
    expect(dup.status).toBe(409)
    expect(dup.body.error).toBe('handle_taken')
  })
  it('rechaza links en nombre y bio', async () => {
    const { h } = await mkUser()
    expect((await post('profile', { handle: 'ana', bio: 'seguime en sitio.com' }, h)).body.error).toBe('text_links')
    expect((await post('profile', { handle: 'ana', name: 'www.malo.ar' }, h)).body.error).toBe('text_links')
  })
  it('cambiar el @usuario se puede una vez cada 30 días; la bio se edita cuando quiera', async () => {
    const { h } = await withProfile('ana')
    expect((await post('profile', { handle: 'ana', bio: 'nueva bio' }, h)).body.profile.bio).toBe('nueva bio')
    expect((await post('profile', { handle: 'ana2' }, h)).status).toBe(200)          // primer cambio permitido
    expect((await post('profile', { handle: 'ana3' }, h)).body.error).toBe('handle_cooldown')
    clock += 31 * 86400000
    expect((await post('profile', { handle: 'ana3' }, h)).status).toBe(200)
  })
  it('el perfil público muestra datos básicos y nunca datos de la cuenta', async () => {
    const { user } = await withProfile('ana', { email: 'secreta@mail.com' })
    const r = await get('profile', { handle: 'ana' })
    expect(r.status).toBe(200)
    expect(r.body.profile).toMatchObject({ handle: 'ana', followers: 0, following: 0, lists: 0 })
    const text = JSON.stringify(r.body)
    expect(text).not.toContain('secreta@mail.com')
    expect(text).not.toContain('userId')
    expect(user.id).toBeTruthy()
  })
  it('/me devuelve el perfil (o null) y el plan', async () => {
    const { h } = await mkUser()
    let me = (await get('me', {}, h)).body
    expect(me.profile).toBeNull()
    expect(me.plan).toEqual({ premium: false, maxLists: 3, maxItems: 50 })
    await post('profile', { handle: 'ana' }, h)
    me = (await get('me', {}, h)).body
    expect(me.profile.handle).toBe('ana')
    expect((await get('me', {})).status).toBe(401)
  })
})

describe('listas', () => {
  it('crear una lista exige perfil', async () => {
    const { h } = await mkUser()
    expect((await post('list', listBody(), h)).body.error).toBe('profile_required')
  })
  it('crea, edita y borra una lista propia', async () => {
    const { h } = await withProfile('ana')
    const created = await post('list', listBody(), h)
    expect(created.status).toBe(200)
    expect(created.body.list).toMatchObject({ title: 'Plan de finde', itemsCount: 2, likes: 0, visibility: 'public' })
    const id = created.body.list.id
    const edited = await post('list', listBody({ id, title: 'Plan de finde v2', items: [item(1), item(2), item(3)] }), h)
    expect(edited.body.list).toMatchObject({ id, title: 'Plan de finde v2', itemsCount: 3 })
    expect((await post('list-delete', { id }, h)).status).toBe(200)
    expect((await get('list', { id })).status).toBe(404)
  })
  it('valida el contenido igual que las reglas compartidas', async () => {
    const { h } = await withProfile('ana')
    expect((await post('list', listBody({ title: 'ab' }), h)).body.error).toBe('title_required')
    expect((await post('list', listBody({ description: 'entrá a sitio.com' }), h)).body.error).toBe('text_links')
    expect((await post('list', listBody({ visibility: 'private' }), h)).body.error).toBe('private_requires_premium')
  })
  it('el plan gratis permite 3 listas; Premium muchas más y privadas', async () => {
    const free = await withProfile('free')
    for (let i = 0; i < 3; i++) expect((await post('list', listBody({ title: `Lista ${i}` }), free.h)).status).toBe(200)
    expect((await post('list', listBody({ title: 'Cuarta' }), free.h)).body.error).toBe('list_limit')
    const prem = await withProfile('prem', { premium: true })
    for (let i = 0; i < 5; i++) expect((await post('list', listBody({ title: `P ${i}` }), prem.h)).status).toBe(200)
    expect((await post('list', listBody({ visibility: 'private' }), prem.h)).body.list.visibility).toBe('private')
  })
  it('nadie edita ni borra la lista de otra persona', async () => {
    const a = await withProfile('ana'); const b = await withProfile('beto')
    const id = (await post('list', listBody(), a.h)).body.list.id
    expect((await post('list', listBody({ id, title: 'Hackeada' }), b.h)).status).toBe(403)
    expect((await post('list-delete', { id }, b.h)).status).toBe(403)
    expect((await post('list-add', { id, item: item(9) }, b.h)).status).toBe(403)
    expect((await get('list', { id })).body.list.title).toBe('Plan de finde')
  })
  it('editar una lista que no existe da 404', async () => {
    const { h } = await withProfile('ana')
    expect((await post('list', listBody({ id: 'inexistente' }), h)).status).toBe(404)
  })
  it('list-add agrega un título, evita repetidos y respeta el máximo', async () => {
    const { h } = await withProfile('ana')
    const id = (await post('list', listBody({ items: [item(1)] }), h)).body.list.id
    expect((await post('list-add', { id, item: item(2) }, h)).body).toMatchObject({ added: true, itemsCount: 2 })
    expect((await post('list-add', { id, item: item(2) }, h)).body).toMatchObject({ added: false, itemsCount: 2 })
    expect((await post('list-add', { id, item: { type: 'x' } }, h)).status).toBe(400)
    const full = (await post('list', listBody({ id, items: Array.from({ length: 50 }, (_, i) => item(i + 1)) }), h))
    expect(full.status).toBe(200)
    expect((await post('list-add', { id, item: item(999) }, h)).body.error).toBe('too_many_items')
  })
  it('una lista pública la ve cualquiera; la privada solo su dueña', async () => {
    const a = await withProfile('ana', { premium: true }); const b = await withProfile('beto')
    const pub = (await post('list', listBody(), a.h)).body.list.id
    const priv = (await post('list', listBody({ title: 'Secreta', visibility: 'private' }), a.h)).body.list.id
    expect((await get('list', { id: pub })).status).toBe(200)                     // sin sesión
    expect((await get('list', { id: priv })).status).toBe(404)
    expect((await get('list', { id: priv }, b.h)).status).toBe(404)
    expect((await get('list', { id: priv }, a.h)).status).toBe(200)
    expect((await get('profile', { handle: 'ana' })).body.lists.map((l) => l.id)).toEqual([pub])   // la privada no aparece en el perfil
  })
  it('el límite de guardados por hora frena el abuso', async () => {
    const { h } = await withProfile('ana')
    const id = (await post('list', listBody(), h)).body.list.id
    let last
    for (let i = 0; i < 31; i++) last = await post('list', listBody({ id, title: `Versión ${i}` }), h)
    expect(last.status).toBe(429)
  })
})

describe('likes', () => {
  let a, b, id
  beforeEach(async () => {
    a = await withProfile('ana'); b = await withProfile('beto')
    id = (await post('list', listBody(), a.h)).body.list.id
  })
  it('dar y quitar like suma y resta una sola vez por persona', async () => {
    expect((await post('like', { id, on: true }, b.h)).body).toEqual({ liked: true, likes: 1 })
    expect((await post('like', { id, on: true }, b.h)).body.likes).toBe(1)          // repetido: no suma
    expect((await post('like', { id, on: true }, a.h)).body.likes).toBe(2)          // otra persona
    expect((await post('like', { id, on: false }, b.h)).body).toEqual({ liked: false, likes: 1 })
    expect((await post('like', { id, on: false }, b.h)).body.likes).toBe(1)         // repetido: no resta
    expect((await get('list', { id }, a.h)).body.viewer.liked).toBe(true)
    expect((await get('list', { id }, b.h)).body.viewer.liked).toBe(false)
  })
  it('requiere sesión y una lista visible', async () => {
    expect((await post('like', { id, on: true }, H)).status).toBe(401)
    expect((await post('like', { id: 'nope', on: true }, b.h)).status).toBe(404)
  })
  it('no se puede dar like a una lista oculta o privada ajena', async () => {
    await social.updateList(id, { hidden: true })
    expect((await post('like', { id, on: true }, b.h)).status).toBe(404)
  })
})

describe('seguir', () => {
  let a, b
  beforeEach(async () => { a = await withProfile('ana'); b = await withProfile('beto') })
  it('seguir y dejar de seguir, con contadores', async () => {
    expect((await post('follow', { handle: 'ana', on: true }, b.h)).body).toEqual({ following: true, followers: 1 })
    expect((await post('follow', { handle: '@Ana', on: true }, b.h)).body.followers).toBe(1)   // repetido
    let p = (await get('profile', { handle: 'ana' }, b.h)).body
    expect(p.profile.followers).toBe(1)
    expect(p.viewer).toEqual({ isMe: false, following: true })
    expect((await get('profile', { handle: 'beto' }, b.h)).body.profile.following).toBe(1)
    expect((await post('follow', { handle: 'ana', on: false }, b.h)).body).toEqual({ following: false, followers: 0 })
    p = (await get('profile', { handle: 'ana' }, b.h)).body
    expect(p.viewer.following).toBe(false)
  })
  it('no te podés seguir a vos mismo ni a quien no existe; requiere sesión', async () => {
    expect((await post('follow', { handle: 'ana', on: true }, a.h)).body.error).toBe('cannot_follow_self')
    expect((await post('follow', { handle: 'fantasma', on: true }, a.h)).status).toBe(404)
    expect((await post('follow', { handle: 'ana', on: true }, H)).status).toBe(401)
  })
  it('se puede seguir sin tener perfil propio', async () => {
    const lurker = await mkUser()
    expect((await post('follow', { handle: 'ana', on: true }, lurker.h)).body.following).toBe(true)
  })
})

describe('feed', () => {
  it('"nuevas" y "populares" son públicas; excluyen privadas, ocultas y vacías', async () => {
    const a = await withProfile('ana', { premium: true })
    const ok1 = (await post('list', listBody({ title: 'Visible' }), a.h)).body.list.id
    await post('list', listBody({ title: 'Privada', visibility: 'private' }), a.h)
    await post('list', listBody({ title: 'Vacía', items: [] }), a.h)
    const hid = (await post('list', listBody({ title: 'Oculta' }), a.h)).body.list.id
    await social.updateList(hid, { hidden: true })
    for (const kind of ['new', 'popular']) {
      const r = await get('feed', { kind })
      expect(r.status).toBe(200)
      expect(r.body.lists.map((l) => l.title)).toEqual(['Visible'])
      expect(r.body.lists[0].owner).toEqual({ handle: 'ana', name: 'Usuario 1' })
    }
    expect(ok1).toBeTruthy()
  })
  it('"populares" ordena por likes', async () => {
    const a = await withProfile('ana'); const b = await withProfile('beto')
    const low = (await post('list', listBody({ title: 'Poco' }), a.h)).body.list.id
    clock += 1000
    const high = (await post('list', listBody({ title: 'Mucho' }), b.h)).body.list.id
    await post('like', { id: low, on: true }, b.h)
    await post('like', { id: low, on: true }, a.h)
    await post('like', { id: high, on: true }, a.h)
    expect((await get('feed', { kind: 'popular' })).body.lists.map((l) => l.title)).toEqual(['Poco', 'Mucho'])
  })
  it('"siguiendo" requiere sesión y solo trae listas de a quienes seguís', async () => {
    const a = await withProfile('ana'); const b = await withProfile('beto'); const c = await withProfile('cami')
    await post('list', listBody({ title: 'De Ana' }), a.h)
    await post('list', listBody({ title: 'De Cami' }), c.h)
    expect((await get('feed', { kind: 'following' })).status).toBe(401)
    expect((await get('feed', { kind: 'following' }, b.h)).body.lists).toEqual([])
    await post('follow', { handle: 'ana', on: true }, b.h)
    expect((await get('feed', { kind: 'following' }, b.h)).body.lists.map((l) => l.title)).toEqual(['De Ana'])
  })
  it('marca cuáles ya tienen mi like', async () => {
    const a = await withProfile('ana'); const b = await withProfile('beto')
    const id = (await post('list', listBody(), a.h)).body.list.id
    await post('like', { id, on: true }, b.h)
    expect((await get('feed', { kind: 'new' }, b.h)).body.lists[0].liked).toBe(true)
    expect((await get('feed', { kind: 'new' })).body.lists[0].liked).toBe(false)
  })
  it('un tipo de feed desconocido cae a "nuevas"', async () => {
    expect((await get('feed', { kind: '__proto__' })).body.kind).toBe('new')
  })
})

describe('reportes y moderación automática', () => {
  let a, id
  beforeEach(async () => { a = await withProfile('ana'); id = (await post('list', listBody(), a.h)).body.list.id })

  it('se puede reportar una vez; no la propia', async () => {
    const b = await withProfile('beto')
    expect((await post('report', { id, reason: 'spam' }, b.h)).body).toEqual({ reported: true, already: false })
    expect((await post('report', { id, reason: 'spam' }, b.h)).body.already).toBe(true)
    expect((await post('report', { id }, a.h)).status).toBe(403)
    expect((await post('report', { id }, H)).status).toBe(401)
    expect((await post('report', { id: 'nope' }, b.h)).status).toBe(404)
  })
  it('con 3 reportes distintos la lista se oculta sola (la dueña todavía la ve)', async () => {
    for (const handle of ['user_1', 'user_2']) { const u = await withProfile(handle); await post('report', { id }, u.h) }
    expect((await get('list', { id })).status).toBe(200)                             // 2 reportes: sigue visible
    const u3 = await withProfile('user_3'); await post('report', { id, reason: 'ofensiva' }, u3.h)
    expect((await get('list', { id })).status).toBe(404)
    expect((await get('feed', { kind: 'new' })).body.lists).toEqual([])
    const mine = await get('list', { id }, a.h)
    expect(mine.status).toBe(200)
    expect(mine.body.list.hidden).toBe(true)
  })
  it('el mismo usuario reportando muchas veces no alcanza para ocultar', async () => {
    const b = await withProfile('beto')
    for (let i = 0; i < 5; i++) await post('report', { id }, b.h)
    expect((await get('list', { id })).status).toBe(200)
  })
  it('el fundador (root) puede ver una lista oculta', async () => {
    await social.updateList(id, { hidden: true })
    const root = await mkUser({ email: ROOT })
    expect((await get('list', { id }, root.h)).status).toBe(200)
  })
})

describe('robustez', () => {
  it('acciones desconocidas dan 404 y entradas raras no rompen nada', async () => {
    const { h } = await withProfile('ana')
    expect((await get('inexistente')).status).toBe(404)
    for (const body of [null, 'x', 5, [], { id: { $gt: '' } }, { id: ['a'] }]) {
      const r = await post('list-delete', body, h)
      expect([400, 404]).toContain(r.status)
    }
    expect((await post('like', { id: { $ne: null }, on: true }, h)).status).toBe(404)
  })
  it('un error interno no filtra detalles', async () => {
    const broken = { ...social, getProfile: async () => { throw new Error('mongodb://u:clave@host explotó') } }
    api = createSocialApi({ store, social: broken, now: () => clock })
    const { h } = await mkUser()
    const r = await get('me', {}, h)
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.body)).toBe('{"error":"server_error"}')
  })
})

describe('borrar la cuenta (derecho al olvido)', () => {
  it('deleteUserData borra perfil, listas, likes (y su suma), follows y reportes de esa persona, y nada más', async () => {
    const ana = await withProfile('ana')
    const bea = await withProfile('bea')
    const lAna = (await post('list', listBody({ title: 'De Ana' }), ana.h)).body.list.id
    const lBea = (await post('list', listBody({ title: 'De Bea' }), bea.h)).body.list.id
    await post('like', { id: lBea, on: true }, ana.h)
    await post('like', { id: lAna, on: true }, bea.h)
    await post('follow', { handle: 'bea', on: true }, ana.h)
    await post('follow', { handle: 'ana', on: true }, bea.h)
    await post('report', { id: lBea, reason: 'x' }, ana.h)

    await social.deleteUserData(ana.user.id)

    expect(await social.getProfile(ana.user.id)).toBeNull()
    expect(await social.getList(lAna)).toBeNull()
    expect((await social.getList(lBea)).likes).toBe(0)                 // su like ya no cuenta
    expect(await social.countFollowers(bea.user.id)).toBe(0)           // dejó de seguirla
    expect(await social.countFollowing(bea.user.id)).toBe(0)           // y ya no la sigue nadie
    expect((await social.stats()).pendingReports).toBe(0)
    expect(await social.getProfile(bea.user.id)).not.toBeNull()        // lo de Bea queda intacto
    expect(await social.getList(lBea)).not.toBeNull()
    expect((await get('profile', { handle: 'ana' })).status).toBe(404)
  })
})
