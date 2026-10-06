// Prueba de humo de la comunidad contra MongoDB REAL, en una base temporal que se borra al terminar.
// Nunca toca la base "lifehigh". Uso (la URI va por variable de entorno, no se escribe en ningún archivo):
//   PowerShell:  $env:MONGODB_URI = "<tu uri>"; node scripts/smoke-social.mjs
import assert from 'node:assert/strict'
import { MongoClient, ObjectId } from 'mongodb'
import { createMongoStore } from '../api/_lib/stores.js'
import { createMongoSocial } from '../api/_lib/socialStore.js'
import { createSocialApi } from '../api/_lib/socialApi.js'
import { sha256 } from '../api/_lib/passwords.js'

const uri = process.env.MONGODB_URI
if (!uri) { console.error('Falta MONGODB_URI en el entorno.'); process.exit(1) }

const dbName = `lifehigh_smoketest_${Date.now()}`
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 })
let failed = false

try {
  await client.connect()
  const db = client.db(dbName)
  const store = createMongoStore(db, { ObjectId })
  const social = createMongoSocial(db, { ObjectId })
  await Promise.all([store.ensureIndexes(), social.ensureIndexes()])
  const api = createSocialApi({ store, social })

  const H = { 'content-type': 'application/json', host: 'smoke.test' }
  const mk = async (n) => {
    const user = await store.createUser({ email: `smoke${n}@test.com`, name: `Smoke ${n}`, emailVerified: true, createdAt: Date.now() - 7 * 86400000, library: {} })
    const token = `smoke-token-${n}-${Date.now()}`
    await store.createSession({ id: sha256(token), userId: user.id, ua: '', createdAt: Date.now(), expiresAt: Date.now() + 86400000 })
    return { user, h: { ...H, cookie: `lh_session=${token}` } }
  }
  const post = (action, body, h) => api({ method: 'POST', action, headers: h, body })
  const get = (action, query, h = { host: 'smoke.test' }) => api({ method: 'GET', action, headers: h, query })
  const step = (name) => console.log(`  ✓ ${name}`)

  const ana = await mk(1)
  const bea = await mk(2)

  assert.equal((await post('profile', { handle: 'ana_smoke' }, ana.h)).status, 200); step('crear perfil')
  assert.equal((await post('profile', { handle: 'bea_smoke' }, bea.h)).status, 200)
  assert.equal((await post('profile', { handle: 'ana_smoke' }, bea.h)).body.error, 'handle_taken'); step('@usuario único (índice)')

  const created = await post('list', { title: 'Plan de finde', tag: 'finde', visibility: 'public', items: [{ type: 'movie', id: 603, title: 'Matrix', poster: '/p.jpg', year: '1999' }] }, ana.h)
  assert.equal(created.status, 200)
  const id = created.body.list.id
  step('crear lista')

  assert.equal((await post('list-add', { id, item: { type: 'tv', id: 1396, title: 'Breaking Bad' } }, ana.h)).body.added, true)
  assert.equal((await get('list', { id })).body.list.itemsCount, 2); step('agregar título y leer lista')

  assert.equal((await post('like', { id, on: true }, bea.h)).body.likes, 1)
  assert.equal((await post('like', { id, on: true }, bea.h)).body.likes, 1); step('like (idempotente)')
  assert.equal((await post('follow', { handle: 'ana_smoke', on: true }, bea.h)).body.followers, 1); step('seguir')

  const following = await get('feed', { kind: 'following' }, bea.h)
  assert.equal(following.body.lists.length, 1); step('feed "Siguiendo"')
  assert.equal((await get('feed', { kind: 'popular' })).body.lists[0].likes, 1); step('feed populares')

  for (const n of [3, 4, 5]) { const u = await mk(n); assert.equal((await post('report', { id, reason: 'x' }, u.h)).status, 200) }
  assert.equal((await get('feed', { kind: 'new' })).body.lists.length, 0); step('3 reportes distintos ocultan la lista')
  assert.equal((await social.reportedLists(10)).length, 1); step('cola de moderación')

  await social.deleteUserData(ana.user.id)
  assert.equal(await social.getProfile(ana.user.id), null)
  assert.equal(await social.getList(id), null)
  assert.equal(await social.countFollowers(ana.user.id), 0)
  assert.equal(await social.countFollowing(bea.user.id), 0); step('borrar cuenta limpia perfil, listas y seguimientos')

  console.log('\nOK: la comunidad funciona contra MongoDB real.')
} catch (e) {
  failed = true
  console.error('\nFALLÓ:', e?.message || e)
} finally {
  try { await client.db(dbName).dropDatabase(); console.log(`Base temporal ${dbName} eliminada.`) } catch { console.error('No pude eliminar la base temporal:', dbName) }
  await client.close()
  process.exit(failed ? 1 : 0)
}
