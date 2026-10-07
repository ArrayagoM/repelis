import { describe, it, expect, beforeEach } from 'vitest'
import { createSocialApi } from '../_lib/socialApi.js'
import { createAdminApi } from '../_lib/adminApi.js'
import { createMemoryStore } from '../_lib/stores.js'
import { createMemorySocial } from '../_lib/socialStore.js'
import { sha256 } from '../_lib/passwords.js'
import { validateComment, parseTarget } from '../../src/lib/socialRules.js'

const T0 = Date.UTC(2026, 9, 6, 15, 0, 0)
const ROOT = 'fundador@mail.com'
let store, social, clock, api, admin, n

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
const withProfile = async (handle, over = {}) => { const u = await mkUser(over); expect((await post('profile', { handle }, u.h)).status).toBe(200); return u }
const mkList = async (u, over = {}) => (await post('list', { title: 'Plan de finde', tag: 'finde', visibility: 'public', items: [{ type: 'movie', id: 1, title: 'Peli' }], ...over }, u.h)).body.list.id

beforeEach(() => {
  store = createMemoryStore(); social = createMemorySocial(); clock = T0; n = 0
  api = createSocialApi({ store, social, now: () => clock, rootEmails: [ROOT] })
  admin = createAdminApi({ store, stats: { getDailies: async () => [], getTitles: async () => [], listOnline: async () => [] }, social, rootEmails: [ROOT], now: () => clock })
})

describe('reglas de comentarios', () => {
  it('parsea destinos válidos y rechaza el resto', () => {
    expect(parseTarget('movie:603')).toMatchObject({ kind: 'movie', id: '603' })
    expect(parseTarget('list:abc_1')).toMatchObject({ kind: 'list' })
    for (const bad of ['', 'movie:', 'movie:x', 'user:1', 'movie:1;drop', 'list:', null, undefined, 'tv:12345678901']) expect(parseTarget(bad)).toBeNull()
  })
  it('valida texto, links y calificación', () => {
    expect(validateComment({ target: 'movie:1', text: '  Muy   buena  ', rating: 5 }).value).toEqual({ target: 'movie:1', text: 'Muy buena', rating: 5 })
    expect(validateComment({ target: 'movie:1', text: 'a' }).error).toBe('comment_required')
    expect(validateComment({ target: 'movie:1', text: 'mirala en pirata.com' }).error).toBe('text_links')
    expect(validateComment({ target: 'movie:1', text: 'bien', rating: 6 }).error).toBe('bad_request')
    expect(validateComment({ target: 'list:abc', text: 'linda lista', rating: 3 }).error).toBe('bad_request')   // las listas no se puntúan
    expect(validateComment({ target: 'movie:1', text: 'x'.repeat(900) }).value.text.length).toBe(500)
  })
})

describe('opiniones en películas y series', () => {
  it('leer es libre; opinar requiere cuenta y mail confirmado o 1 h (el perfil se crea solo)', async () => {
    expect((await get('comments', { target: 'movie:603' })).status).toBe(200)
    expect((await post('comment', { target: 'movie:603', text: 'Genial' }, H)).status).toBe(401)
    const noProfile = await mkUser()
    expect((await post('comment', { target: 'movie:603', text: 'Genial' }, noProfile.h)).status).toBe(200)
    expect(await social.getProfile(noProfile.user.id)).toMatchObject({ handle: expect.stringMatching(/^[a-z0-9_]{3,20}$/) })
    const fresh = await mkUser({ emailVerified: false, createdAt: clock - 60_000 })
    expect((await post('comment', { target: 'movie:603', text: 'Genial' }, fresh.h)).body.error).toBe('cannot_publish_yet')
  })

  it('una opinión por persona y película: volver a opinar la reemplaza y promedia bien', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    expect((await post('comment', { target: 'movie:603', text: 'Buenísima', rating: 5 }, ana.h)).body.updated).toBe(false)
    expect((await post('comment', { target: 'movie:603', text: 'Está bien', rating: 3 }, bea.h)).status).toBe(200)
    let r = await get('comments', { target: 'movie:603' })
    expect(r.body.summary).toEqual({ count: 2, rated: 2, avg: 4 })

    const again = await post('comment', { target: 'movie:603', text: 'La volví a ver: 4 estrellas', rating: 4 }, ana.h)
    expect(again.body.updated).toBe(true)
    r = await get('comments', { target: 'movie:603' }, ana.h)
    expect(r.body.summary).toEqual({ count: 2, rated: 2, avg: 3.5 })
    expect(r.body.comments.find((c) => c.mine)).toMatchObject({ text: 'La volví a ver: 4 estrellas', edited: true, canDelete: true })
    expect(r.body.viewer).toMatchObject({ hasComment: true })
    expect(r.body.comments.find((c) => !c.mine).canDelete).toBe(false)
  })

  it('no filtra datos privados de quien opina', async () => {
    const ana = await withProfile('ana')
    await post('comment', { target: 'tv:1396', text: 'Una joya' }, ana.h)
    const r = await get('comments', { target: 'tv:1396' })
    expect(JSON.stringify(r.body)).not.toMatch(/@mail\.com|authorId|ownerId/)
    expect(r.body.comments[0].author).toEqual({ handle: 'ana', name: 'Usuario 1' })
  })

  it('destinos inválidos dan 400 y la entrada rara no rompe', async () => {
    const ana = await withProfile('ana')
    expect((await get('comments', { target: 'user:1' })).status).toBe(400)
    for (const body of [null, 'x', { target: { $ne: 1 }, text: 'hola' }, { target: 'movie:1', text: { $gt: '' } }]) {
      expect([400]).toContain((await post('comment', body, ana.h)).status)
    }
  })

  it('limita 20 por hora', async () => {
    const ana = await withProfile('ana')
    let last
    for (let i = 1; i <= 21; i++) last = await post('comment', { target: `movie:${i}`, text: 'Comentario ' + i }, ana.h)
    expect(last.status).toBe(429)
  })
})

describe('comentarios en listas', () => {
  it('se comenta una lista pública; una privada u oculta no existe para los demás', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    const id = await mkList(ana)
    expect((await post('comment', { target: `list:${id}`, text: '¡Qué buena lista!' }, bea.h)).status).toBe(200)
    expect((await post('comment', { target: `list:${id}`, text: 'Y otra más' }, bea.h)).status).toBe(200)   // en listas se puede más de una vez
    expect((await get('comments', { target: `list:${id}` })).body.comments).toHaveLength(2)

    await social.updateList(id, { hidden: true })
    expect((await get('comments', { target: `list:${id}` })).status).toBe(404)
    expect((await post('comment', { target: `list:${id}`, text: 'hola' }, bea.h)).status).toBe(404)
    expect((await get('comments', { target: `list:${id}` }, ana.h)).status).toBe(200)       // la dueña sí
    expect((await get('comments', { target: 'list:inexistente' })).status).toBe(404)
  })

  it('la dueña de la lista, la autora y el fundador pueden borrar; otras personas no', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea'), cami = await withProfile('cami')
    const founder = await mkUser({ email: ROOT })
    const id = await mkList(ana)
    const c1 = (await post('comment', { target: `list:${id}`, text: 'Comentario de Bea' }, bea.h)).body.comment.id

    expect((await post('comment-delete', { id: c1 }, cami.h)).status).toBe(403)
    expect((await post('comment-delete', { id: c1 }, H)).status).toBe(401)
    expect((await post('comment-delete', { id: c1 }, ana.h)).status).toBe(200)              // dueña de la lista
    const c2 = (await post('comment', { target: `list:${id}`, text: 'Otro de Bea' }, bea.h)).body.comment.id
    expect((await post('comment-delete', { id: c2 }, bea.h)).status).toBe(200)              // autora
    const c3 = (await post('comment', { target: `list:${id}`, text: 'Un tercero' }, bea.h)).body.comment.id
    expect((await post('comment-delete', { id: c3 }, founder.h)).status).toBe(200)          // fundador
    expect((await get('comments', { target: `list:${id}` })).body.comments).toHaveLength(0)
  })

  it('borrar la lista borra sus comentarios; borrar la cuenta borra los de esa persona', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    const id = await mkList(ana)
    await post('comment', { target: `list:${id}`, text: 'Comentario' }, bea.h)
    await post('comment', { target: 'movie:603', text: 'Opinión de Bea' }, bea.h)
    await post('list-delete', { id }, ana.h)
    expect((await social.stats()).comments).toBe(1)
    await social.deleteUserData(bea.user.id)
    expect((await social.stats()).comments).toBe(0)
  })
})

describe('reportes y moderación de comentarios', () => {
  it('3 reportes distintos ocultan el comentario; no se puede reportar el propio', async () => {
    const ana = await withProfile('ana')
    const cid = (await post('comment', { target: 'movie:603', text: 'Texto dudoso' }, ana.h)).body.comment.id
    expect((await post('comment-report', { id: cid, reason: 'x' }, ana.h)).status).toBe(403)
    for (const name of ['rep_uno', 'rep_dos', 'rep_tres']) {
      const u = await withProfile(name)
      expect((await post('comment-report', { id: cid, reason: 'spam' }, u.h)).status).toBe(200)
    }
    expect((await get('comments', { target: 'movie:603' })).body.comments).toHaveLength(0)
    expect((await get('comments', { target: 'movie:603' })).body.summary.count).toBe(0)
  })

  it('el mismo reporte dos veces no suma', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    const cid = (await post('comment', { target: 'movie:603', text: 'Texto' }, ana.h)).body.comment.id
    await post('comment-report', { id: cid }, bea.h)
    expect((await post('comment-report', { id: cid }, bea.h)).body.already).toBe(true)
    expect((await get('comments', { target: 'movie:603' })).body.comments).toHaveLength(1)
  })

  it('el panel lista los reportes de comentarios y permite descartar, ocultar y borrar', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    const founder = await mkUser({ email: ROOT })
    const cid = (await post('comment', { target: 'movie:603', text: 'Reportado' }, ana.h)).body.comment.id
    await post('comment-report', { id: cid, reason: 'ofensivo' }, bea.h)

    const call = (method, action, body) => admin({ method, action, headers: { ...founder.h }, body, query: {} })
    const reports = (await call('GET', 'reports')).body.reports
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({ kind: 'comment', commentId: cid, title: 'Reportado', owner: 'ana', reports: 1 })

    expect((await call('POST', 'moderate', { commentId: cid, decision: 'hide' })).status).toBe(200)
    expect((await social.getComment(cid)).hidden).toBe(true)
    expect((await call('POST', 'moderate', { commentId: cid, decision: 'dismiss' })).status).toBe(200)
    expect((await social.getComment(cid)).hidden).toBe(false)
    expect((await call('GET', 'reports')).body.reports).toHaveLength(0)
    expect((await call('POST', 'moderate', { commentId: cid, decision: 'delete' })).status).toBe(200)
    expect(await social.getComment(cid)).toBeNull()
    expect((await call('POST', 'moderate', { commentId: 'nope', decision: 'hide' })).status).toBe(404)
  })

  it('un usuario común no puede moderar', async () => {
    const ana = await withProfile('ana')
    const r = await admin({ method: 'POST', action: 'moderate', headers: ana.h, body: { commentId: 'c1', decision: 'delete' }, query: {} })
    expect([401, 403, 404]).toContain(r.status)
  })
})

describe('me gusta en películas, series y comentarios', () => {
  it('se da y se quita me gusta a una película, con contador y estado por persona', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    expect((await post('react', { key: 'movie:603', on: true }, H)).status).toBe(401)
    expect((await post('react', { key: 'movie:603', on: true }, ana.h)).body).toEqual({ liked: true, likes: 1 })
    expect((await post('react', { key: 'movie:603', on: true }, ana.h)).body.likes).toBe(1)        // no se duplica
    expect((await post('react', { key: 'movie:603', on: true }, bea.h)).body.likes).toBe(2)
    const r = await get('comments', { target: 'movie:603' }, ana.h)
    expect(r.body.likes).toEqual({ count: 2, liked: true })
    expect((await get('comments', { target: 'movie:603' })).body.likes).toEqual({ count: 2, liked: false })   // sin sesión
    expect((await post('react', { key: 'movie:603', on: false }, ana.h)).body).toEqual({ liked: false, likes: 1 })
    expect((await get('comments', { target: 'tv:1396' })).body.likes.count).toBe(0)
  })

  it('claves inválidas se rechazan (las listas usan su propio me gusta)', async () => {
    const ana = await withProfile('ana')
    for (const key of ['', 'list:abc', 'user:1', 'movie:x', { $ne: 1 }, null, 'c:inexistente']) {
      expect([400, 404]).toContain((await post('react', { key, on: true }, ana.h)).status)
    }
  })

  it('me gusta en un comentario: cuenta, avisa a su autor y se borra con el comentario', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    const cid = (await post('comment', { target: 'movie:603', text: 'Una joya', rating: 5 }, ana.h)).body.comment.id
    expect((await post('react', { key: `c:${cid}`, on: true }, bea.h)).body).toEqual({ liked: true, likes: 1 })
    const r = await get('comments', { target: 'movie:603' }, bea.h)
    expect(r.body.comments[0]).toMatchObject({ likes: 1, liked: true })
    const notes = (await get('notifications', {}, ana.h)).body.items
    expect(notes.find((n) => n.type === 'like')).toMatchObject({ text: 'A @bea le gustó tu opinión', link: '/movie/603' })
    await post('react', { key: `c:${cid}`, on: true }, ana.h)           // el autor puede dar like al suyo, sin aviso a sí mismo
    expect((await get('notifications', {}, ana.h)).body.items.filter((n) => n.type === 'like')).toHaveLength(1)
    await post('comment-delete', { id: cid }, ana.h)
    expect((await social.countLikesMany([`c:${cid}`])).get(`c:${cid}`)).toBe(0)
  })

  it('no se puede dar me gusta a un comentario oculto ni de una lista oculta', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    const id = await mkList(ana)
    const cid = (await post('comment', { target: `list:${id}`, text: 'Hola' }, ana.h)).body.comment.id
    await social.updateList(id, { hidden: true })
    expect((await post('react', { key: `c:${cid}`, on: true }, bea.h)).status).toBe(404)
    await social.updateList(id, { hidden: false })
    await social.updateComment(cid, { hidden: true })
    expect((await post('react', { key: `c:${cid}`, on: true }, bea.h)).status).toBe(404)
  })

  it('borrar la cuenta deja la suma de me gusta ajena intacta y limpia los de esa persona', async () => {
    const ana = await withProfile('ana'), bea = await withProfile('bea')
    await post('react', { key: 'movie:603', on: true }, ana.h)
    await post('react', { key: 'movie:603', on: true }, bea.h)
    await social.deleteUserData(ana.user.id)
    expect((await get('comments', { target: 'movie:603' })).body.likes.count).toBe(1)
  })
})

describe('only=likes', () => {
  it('devuelve solo los me gusta de la película, liviano', async () => {
    const ana = await withProfile('ana')
    await post('react', { key: 'movie:9', on: true }, ana.h)
    const r = await get('comments', { target: 'movie:9', only: 'likes' }, ana.h)
    expect(r.body).toEqual({ target: 'movie:9', likes: { count: 1, liked: true } })
  })
})
