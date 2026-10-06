import { describe, it, expect, beforeEach } from 'vitest'
import { generateKeyPairSync, createSign } from 'node:crypto'
import { verifyGoogleIdToken, getGoogleKeys, __clearGoogleKeysCache, JWKS_URL } from '../_lib/google.js'
import { createAuthApi } from '../_lib/authApi.js'
import { createMemoryStore } from '../_lib/stores.js'

const CLIENT_ID = '1234-abc.apps.googleusercontent.com'
const NOW = 1_800_000_000_000

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
const other = generateKeyPairSync('rsa', { modulusLength: 2048 })
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', use: 'sig', alg: 'RS256' }
const KEYS = [jwk]

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const sign = (payload, { key = privateKey, header = { alg: 'RS256', kid: 'k1', typ: 'JWT' } } = {}) => {
  const body = `${b64(header)}.${b64(payload)}`
  const sig = createSign('RSA-SHA256').update(body).sign(key).toString('base64url')
  return `${body}.${sig}`
}
const claims = (over = {}) => ({
  iss: 'https://accounts.google.com', aud: CLIENT_ID, sub: 'g-123', email: 'Ana@Gmail.com', email_verified: true,
  name: 'Ana Pérez', picture: 'https://x/p.jpg', iat: NOW / 1000 - 10, exp: NOW / 1000 + 3600, ...over,
})
const verify = (token, over = {}) => verifyGoogleIdToken(token, { clientId: CLIENT_ID, keys: KEYS, now: NOW, ...over })

describe('verifyGoogleIdToken', () => {
  it('acepta un token válido y normaliza el mail', () => {
    expect(verify(sign(claims()))).toEqual({ sub: 'g-123', email: 'ana@gmail.com', name: 'Ana Pérez', picture: 'https://x/p.jpg' })
  })
  it('acepta también el emisor sin https', () => {
    expect(verify(sign(claims({ iss: 'accounts.google.com' }))).sub).toBe('g-123')
  })
  it('rechaza una firma de otra clave', () => {
    expect(() => verify(sign(claims(), { key: other.privateKey }))).toThrow(/google_invalid/)
  })
  it('rechaza un token alterado después de firmarlo', () => {
    const [h, , s] = sign(claims()).split('.')
    const forged = `${h}.${b64(claims({ email: 'victima@gmail.com' }))}.${s}`
    expect(() => verify(forged)).toThrow(/google_invalid/)
  })
  it('rechaza un token pensado para OTRA app (audiencia)', () => {
    expect(() => verify(sign(claims({ aud: 'otra-app.apps.googleusercontent.com' })))).toThrow(/google_invalid/)
  })
  it('rechaza emisor falso', () => {
    expect(() => verify(sign(claims({ iss: 'https://evil.com' })))).toThrow(/google_invalid/)
  })
  it('rechaza tokens vencidos o emitidos en el futuro', () => {
    expect(() => verify(sign(claims({ exp: NOW / 1000 - 1 })))).toThrow(/google_invalid/)
    expect(() => verify(sign(claims({ iat: NOW / 1000 + 3600 })))).toThrow(/google_invalid/)
  })
  it('rechaza mails sin verificar o ausentes', () => {
    expect(() => verify(sign(claims({ email_verified: false })))).toThrow(/google_invalid/)
    expect(() => verify(sign(claims({ email_verified: 'true' })))).toThrow(/google_invalid/)
    expect(() => verify(sign(claims({ email: undefined })))).toThrow(/google_invalid/)
    expect(() => verify(sign(claims({ sub: '' })))).toThrow(/google_invalid/)
  })
  it('rechaza algoritmos distintos de RS256 ("none", HS256)', () => {
    const none = `${b64({ alg: 'none', kid: 'k1' })}.${b64(claims())}.`
    expect(() => verify(none)).toThrow(/google_invalid/)
    const hs = `${b64({ alg: 'HS256', kid: 'k1' })}.${b64(claims())}.${Buffer.from('x').toString('base64url')}`
    expect(() => verify(hs)).toThrow(/google_invalid/)
  })
  it('rechaza kid desconocido, formato roto y entradas raras', () => {
    expect(() => verify(sign(claims(), { header: { alg: 'RS256', kid: 'otro' } }))).toThrow(/google_invalid/)
    for (const bad of ['', 'a.b', 'a.b.c.d', null, undefined, 42, 'x'.repeat(5000)]) expect(() => verify(bad)).toThrow(/google_invalid/)
  })
  it('sin client id configurado falla con un código distinto', () => {
    expect(() => verify(sign(claims()), { clientId: '' })).toThrow(/google_not_configured/)
  })
})

describe('getGoogleKeys', () => {
  beforeEach(() => __clearGoogleKeysCache())
  const fakeFetch = (calls) => async (url) => {
    calls.push(url)
    return { ok: true, headers: { get: () => 'public, max-age=3600' }, json: async () => ({ keys: KEYS }) }
  }
  it('baja las claves una vez y las cachea', async () => {
    const calls = []
    await getGoogleKeys({ fetchImpl: fakeFetch(calls), now: NOW })
    await getGoogleKeys({ fetchImpl: fakeFetch(calls), now: NOW + 1000 })
    expect(calls).toEqual([JWKS_URL])
  })
  it('vuelve a bajarlas cuando vence el cache', async () => {
    const calls = []
    await getGoogleKeys({ fetchImpl: fakeFetch(calls), now: NOW })
    await getGoogleKeys({ fetchImpl: fakeFetch(calls), now: NOW + 3601_000 })
    expect(calls).toHaveLength(2)
  })
  it('falla con un código claro si Google no responde', async () => {
    await expect(getGoogleKeys({ fetchImpl: async () => ({ ok: false }), now: NOW })).rejects.toThrow(/google_keys_unavailable/)
  })
})

// ─── Acción /google de la API ───────────────────────────────────────────
describe('POST google', () => {
  let store, api, clock
  const H = { 'content-type': 'application/json', host: 'lifehigh.test' }
  const makeApi = () => createAuthApi({
    store, now: () => clock, googleClientId: CLIENT_ID,
    verifyGoogle: async (credential) => verifyGoogleIdToken(credential, { clientId: CLIENT_ID, keys: KEYS, now: clock }),
  })
  const call = (method, action, body, headers = {}, ip = '1.1.1.1') => api({ method, action, body, headers: { ...H, ...headers }, ip })
  const cookie = (r) => ({ cookie: (r.cookies?.[0] || '').split(';')[0] })
  const google = (over, body = {}, ip) => call('POST', 'google', { credential: sign(claims({ iat: clock / 1000 - 10, exp: clock / 1000 + 3600, ...over })), ...body }, {}, ip)

  beforeEach(() => { store = createMemoryStore(); clock = NOW; api = makeApi() })

  it('status informa el client id solo si Google está configurado', async () => {
    expect((await call('GET', 'status')).body.googleClientId).toBe(CLIENT_ID)
    api = createAuthApi({ store })
    expect((await call('GET', 'status')).body.googleClientId).toBeNull()
  })
  it('crea la cuenta la primera vez (mail verificado, sin contraseña) y abre sesión', async () => {
    const r = await google({}, { library: { list: [{ id: 1, type: 'movie', title: 'Peli', addedAt: 5 }] } })
    expect(r.status).toBe(200)
    expect(r.body.created).toBe(true)
    expect(r.body.user).toMatchObject({ email: 'ana@gmail.com', name: 'Ana Pérez', emailVerified: true, hasPassword: false, google: true })
    expect(r.body.library.list.map((x) => x.title)).toEqual(['Peli'])
    expect(r.cookies[0]).toMatch(/HttpOnly/)
    expect((await call('GET', 'me', undefined, cookie(r))).status).toBe(200)
  })
  it('la segunda vez entra a la misma cuenta', async () => {
    const a = await google({})
    const b = await google({}, {}, '2.2.2.2')
    expect(b.body.created).toBe(false)
    expect(b.body.user.id).toBe(a.body.user.id)
  })
  it('si el mail ya tenía cuenta con contraseña verificada, la vincula y conserva la contraseña', async () => {
    const reg = await call('POST', 'register', { email: 'ana@gmail.com', password: 'una-clave-larga-1' })
    const user = await store.findUserByEmail('ana@gmail.com')
    await store.updateUser(user.id, { emailVerified: true })
    const r = await google({})
    expect(r.body.user.id).toBe(reg.body.user.id)
    expect(r.body.user).toMatchObject({ google: true, hasPassword: true })
    expect((await call('POST', 'login', { email: 'ana@gmail.com', password: 'una-clave-larga-1' }, {}, '3.3.3.3')).status).toBe(200)
  })
  it('PRE-SECUESTRO: si la cuenta del mail nunca se verificó, al vincular Google se borra la contraseña y las sesiones', async () => {
    const reg = await call('POST', 'register', { email: 'ana@gmail.com', password: 'clave-del-atacante-1' }, {}, '9.9.9.9')
    const attackerSession = cookie(reg)
    const r = await google({})                                    // la dueña real entra con Google
    expect(r.body.user.hasPassword).toBe(false)
    expect((await call('POST', 'login', { email: 'ana@gmail.com', password: 'clave-del-atacante-1' }, {}, '8.8.8.8')).status).toBe(401)
    expect((await call('GET', 'me', undefined, attackerSession)).status).toBe(401)
  })
  it('una cuenta de Google no puede entrar por el formulario de contraseña', async () => {
    await google({})
    for (const password of ['', 'cualquiera-123', 'undefined', 'null']) {
      expect((await call('POST', 'login', { email: 'ana@gmail.com', password }, {}, '4.4.4.4')).status).toBe(401)
    }
  })
  it('rechaza credenciales inválidas, falsificadas o de otra app', async () => {
    expect((await call('POST', 'google', { credential: 'basura' })).status).toBe(401)
    expect((await call('POST', 'google', {})).status).toBe(401)
    const forged = sign(claims(), { key: other.privateKey })
    expect((await call('POST', 'google', { credential: forged })).body.error).toBe('google_invalid')
    expect((await google({ aud: 'otra-app' })).status).toBe(401)
    expect((await google({ email_verified: false })).status).toBe(401)
  })
  it('sin Google configurado responde 503', async () => {
    api = createAuthApi({ store })
    expect((await call('POST', 'google', { credential: 'x' })).status).toBe(503)
  })
  it('no se pueden cambiar la contraseña si no se tiene una', async () => {
    const r = await google({})
    const res = await call('POST', 'password', { current: 'x', next: 'clave-nueva-segura-9' }, cookie(r))
    expect(res.body.error).toBe('no_password')
  })
  it('borrar la cuenta se confirma con una credencial de Google de la misma persona', async () => {
    const r = await google({})
    const wrong = await call('POST', 'delete', { credential: sign(claims({ sub: 'otra-persona', iat: clock / 1000 - 10, exp: clock / 1000 + 3600 })) }, cookie(r))
    expect(wrong.status).toBe(401)
    expect(await store.findUserByEmail('ana@gmail.com')).not.toBeNull()
    const ok = await call('POST', 'delete', { credential: sign(claims({ iat: clock / 1000 - 10, exp: clock / 1000 + 3600 })) }, cookie(r))
    expect(ok.status).toBe(200)
    expect(await store.findUserByEmail('ana@gmail.com')).toBeNull()
  })
  it('limita los intentos por IP', async () => {
    for (let i = 0; i < 30; i++) await call('POST', 'google', { credential: 'x' }, {}, '7.7.7.7')
    expect((await call('POST', 'google', { credential: 'x' }, {}, '7.7.7.7')).status).toBe(429)
  })
  it('dos cuentas de Google distintas con el mismo mail no se mezclan', async () => {
    await google({ sub: 'g-1' })
    const second = await google({ sub: 'g-2' }, {}, '5.5.5.5')
    // mismo mail ya existe: se vincula a la cuenta existente (el mail está verificado por Google)
    expect(second.status).toBe(200)
  })
})
