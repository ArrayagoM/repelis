import { describe, it, expect, beforeEach } from 'vitest'
import { createAuthApi, passwordProblem, normalizeEmail, isValidEmail, SESSION_TTL_MS } from '../_lib/authApi.js'
import { createMemoryStore } from '../_lib/stores.js'
import { hashPassword, verifyPassword, sha256, newToken } from '../_lib/passwords.js'

const JSON_H = { 'content-type': 'application/json', host: 'lifehigh.test' }
let store, mails, clock, api

const mailer = () => ({
  sendVerify: async (to, token) => { mails.push({ kind: 'verify', to, token }) },
  sendReset: async (to, token) => { mails.push({ kind: 'reset', to, token }) },
})

beforeEach(() => {
  store = createMemoryStore()
  mails = []
  clock = 1_800_000_000_000
  api = createAuthApi({ store, mailer: mailer(), now: () => clock })
})

const call = (method, action, body, headers = {}, ip = '1.1.1.1') =>
  api({ method, action, body, headers: { ...(method === 'POST' ? JSON_H : { host: 'lifehigh.test' }), ...headers }, ip })

const cookieOf = (res) => (res.cookies?.[0] || '').split(';')[0]        // "lh_session=..."
const withCookie = (res) => ({ cookie: cookieOf(res) })

const register = (over = {}) => call('POST', 'register', { email: 'ana@mail.com', password: 'una-clave-larga-1', name: 'Ana', ...over })

describe('validaciones', () => {
  it('normaliza y valida mails', () => {
    expect(normalizeEmail('  Ana@Mail.COM ')).toBe('ana@mail.com')
    expect(isValidEmail('ana@mail.com')).toBe(true)
    for (const bad of ['', 'ana', 'ana@', '@mail.com', 'a b@mail.com', 'ana@mail', null, 42]) expect(isValidEmail(bad)).toBe(false)
  })
  it('evalúa contraseñas', () => {
    expect(passwordProblem('corta')).toBe('password_short')
    expect(passwordProblem('x'.repeat(201))).toBe('password_long')
    expect(passwordProblem('12345678')).toBe('password_weak')
    expect(passwordProblem('ana@mail.com', 'ana@mail.com')).toBe('password_weak')
    expect(passwordProblem('una-clave-larga-1')).toBeNull()
    expect(passwordProblem(undefined)).toBe('password_invalid')
  })
})

describe('contraseñas y tokens', () => {
  it('hashea con sal y verifica', async () => {
    const h1 = await hashPassword('secreto-123')
    const h2 = await hashPassword('secreto-123')
    expect(h1).not.toBe(h2)
    expect(h1.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('secreto-123', h1)).toBe(true)
    expect(await verifyPassword('otro', h1)).toBe(false)
  })
  it('verifyPassword nunca lanza con formatos raros ni parámetros peligrosos', async () => {
    for (const bad of ['', 'x', 'bcrypt$1$2', 'scrypt$999999999$8$1$AAAA$AAAA', 'scrypt$16384$8$1$$', null, undefined]) {
      expect(await verifyPassword('x', bad)).toBe(false)
    }
  })
  it('tokens únicos y largos; sha256 estable', () => {
    expect(newToken()).not.toBe(newToken())
    expect(newToken().length).toBeGreaterThanOrEqual(43)
    expect(sha256('a')).toBe(sha256('a'))
    expect(sha256('a')).toHaveLength(64)
  })
})

describe('registro', () => {
  it('crea la cuenta, abre sesión y manda el mail de verificación', async () => {
    const res = await register()
    expect(res.status).toBe(200)
    expect(res.body.user).toMatchObject({ email: 'ana@mail.com', name: 'Ana', emailVerified: false })
    expect(res.body.user.passHash).toBeUndefined()
    expect(cookieOf(res)).toMatch(/^lh_session=.+/)
    expect(res.cookies[0]).toMatch(/HttpOnly/)
    expect(res.cookies[0]).toMatch(/SameSite=Lax/)
    expect(res.cookies[0]).toMatch(/Secure/)
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({ kind: 'verify', to: 'ana@mail.com' })
  })
  it('nunca guarda la contraseña en claro ni el token de sesión', async () => {
    const res = await register()
    const user = await store.findUserByEmail('ana@mail.com')
    expect(JSON.stringify(user)).not.toContain('una-clave-larga-1')
    expect(user.passHash.startsWith('scrypt$')).toBe(true)
    const token = cookieOf(res).split('=')[1]
    expect(await store.getSession(token)).toBeNull()                 // solo se guarda el hash
    expect(await store.getSession(sha256(token))).not.toBeNull()
  })
  it('rechaza mails inválidos, contraseñas débiles y duplicados', async () => {
    expect((await register({ email: 'mal' })).body.error).toBe('email_invalid')
    expect((await register({ password: '123' })).body.error).toBe('password_short')
    expect((await register({ password: 'password' })).body.error).toBe('password_weak')
    await register()
    const dup = await register({ email: 'ANA@mail.com' })
    expect(dup.status).toBe(409)
    expect(dup.body.error).toBe('email_taken')
  })
  it('sube la biblioteca del dispositivo al registrarse (y la sanea)', async () => {
    const res = await register({
      library: { list: [{ id: 1, type: 'movie', title: 'Peli', addedAt: 5 }, { id: 'x', type: 'movie' }], evil: 1 },
    })
    expect(res.body.library.list.map((x) => x.id)).toEqual([1])
    expect(res.body.library.evil).toBeUndefined()
  })
  it('funciona sin servicio de mail', async () => {
    api = createAuthApi({ store, mailer: null, now: () => clock })
    const res = await register()
    expect(res.status).toBe(200)
    expect(res.body.mailSent).toBe(false)
  })
  it('limita los registros por IP', async () => {
    for (let i = 0; i < 5; i++) await register({ email: `u${i}@mail.com` })
    expect((await register({ email: 'u9@mail.com' })).status).toBe(429)
    // otra IP no está bloqueada
    expect((await call('POST', 'register', { email: 'otro@mail.com', password: 'una-clave-larga-1' }, {}, '9.9.9.9')).status).toBe(200)
  })
})

describe('login y sesión', () => {
  beforeEach(async () => { await register() })

  it('entra con las credenciales correctas (sin importar mayúsculas del mail)', async () => {
    const res = await call('POST', 'login', { email: 'Ana@Mail.com', password: 'una-clave-larga-1' })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe('ana@mail.com')
    expect(cookieOf(res)).toMatch(/^lh_session=/)
  })
  it('responde igual si la contraseña es mala o el mail no existe', async () => {
    const bad = await call('POST', 'login', { email: 'ana@mail.com', password: 'incorrecta-123' })
    const none = await call('POST', 'login', { email: 'nadie@mail.com', password: 'incorrecta-123' })
    expect(bad.status).toBe(401)
    expect(none.status).toBe(401)
    expect(bad.body).toEqual(none.body)
    expect(bad.cookies).toBeUndefined()
  })
  it('bloquea tras demasiados intentos fallidos a la misma cuenta', async () => {
    for (let i = 0; i < 8; i++) await call('POST', 'login', { email: 'ana@mail.com', password: `mala-${i}-xxxx` })
    const blocked = await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' })
    expect(blocked.status).toBe(429)
  })
  it('el bloqueo vence con el tiempo', async () => {
    for (let i = 0; i < 8; i++) await call('POST', 'login', { email: 'ana@mail.com', password: `mala-${i}-xxxx` })
    clock += 16 * 60_000
    expect((await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' })).status).toBe(200)
  })
  it('"me" devuelve el usuario con sesión y 401 sin ella', async () => {
    const login = await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' })
    const me = await call('GET', 'me', undefined, withCookie(login))
    expect(me.status).toBe(200)
    expect(me.body.user.email).toBe('ana@mail.com')
    expect((await call('GET', 'me')).status).toBe(401)
    expect((await call('GET', 'me', undefined, { cookie: 'lh_session=inventada' })).status).toBe(401)
  })
  it('la sesión vence a los 30 días', async () => {
    const login = await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' })
    clock += SESSION_TTL_MS + 1000
    expect((await call('GET', 'me', undefined, withCookie(login))).status).toBe(401)
  })
  it('logout cierra la sesión y borra la cookie', async () => {
    const login = await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' })
    const out = await call('POST', 'logout', {}, withCookie(login))
    expect(out.cookies[0]).toMatch(/Max-Age=0/)
    expect((await call('GET', 'me', undefined, withCookie(login))).status).toBe(401)
  })
  it('limita las sesiones abiertas por usuario', async () => {
    for (let i = 0; i < 12; i++) await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' }, {}, `5.5.5.${i}`)
    const user = await store.findUserByEmail('ana@mail.com')
    expect(await store.countSessions(user.id)).toBeLessThanOrEqual(10)
  })
})

describe('protección contra pedidos de otros sitios (CSRF)', () => {
  it('rechaza POST sin JSON', async () => {
    const res = await api({ method: 'POST', action: 'login', body: {}, headers: { host: 'lifehigh.test', 'content-type': 'text/plain' }, ip: '1.1.1.1' })
    expect(res.status).toBe(415)
  })
  it('rechaza POST de otro origen', async () => {
    const res = await call('POST', 'login', { email: 'a@b.co', password: 'x'.repeat(10) }, { origin: 'https://sitio-malo.com' })
    expect(res.status).toBe(403)
  })
  it('acepta el mismo origen y rechaza Sec-Fetch-Site cross-site', async () => {
    expect((await call('POST', 'login', { email: 'a@b.co', password: 'x'.repeat(10) }, { origin: 'https://lifehigh.test' })).status).toBe(401)
    expect((await call('POST', 'login', { email: 'a@b.co', password: 'x'.repeat(10) }, { 'sec-fetch-site': 'cross-site' })).status).toBe(403)
  })
  it('acciones desconocidas dan 404', async () => {
    expect((await call('GET', 'nada')).status).toBe(404)
    expect((await call('POST', 'admin', {})).status).toBe(404)
  })
})

describe('sincronización', () => {
  let cookie
  beforeEach(async () => { cookie = withCookie(await register()) })

  const item = (id, over = {}) => ({ id, type: 'movie', title: `T${id}`, addedAt: 1000 + id, ...over })

  it('requiere sesión', async () => {
    expect((await call('POST', 'sync', { library: {} })).status).toBe(401)
  })
  it('guarda y devuelve la biblioteca fusionada', async () => {
    const a = await call('POST', 'sync', { library: { list: [item(1)] } }, cookie)
    expect(a.body.library.list.map((x) => x.id)).toEqual([1])
    const b = await call('POST', 'sync', { library: { list: [item(2)] } }, cookie)
    expect(b.body.library.list.map((x) => x.id).sort()).toEqual([1, 2])
  })
  it('un segundo dispositivo recibe lo del primero', async () => {
    await call('POST', 'sync', { library: { list: [item(1)], days: ['2026-10-05'] } }, cookie)
    const login = await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' }, {}, '2.2.2.2')
    expect(login.body.library.list.map((x) => x.id)).toEqual([1])
    const sync = await call('POST', 'sync', { library: {} }, withCookie(login))
    expect(sync.body.library.days).toEqual(['2026-10-05'])
  })
  it('respeta los borrados entre dispositivos', async () => {
    await call('POST', 'sync', { library: { list: [item(1, { addedAt: 100 })] } }, cookie)
    const r = await call('POST', 'sync', { library: { tombs: { 'list:movie:1': clock - 10 } } }, cookie)
    expect(r.body.library.list).toEqual([])
  })
  it('es idempotente', async () => {
    const lib = { list: [item(1), item(2)], history: [{ id: 3, type: 'movie', updatedAt: 5, runtimeMin: 90, watchedSec: 60 }] }
    const a = await call('POST', 'sync', { library: lib }, cookie)
    const b = await call('POST', 'sync', { library: a.body.library }, cookie)
    expect(b.body.library).toEqual(a.body.library)
  })
  it('sanea lo que manda el cliente y rechaza bibliotecas gigantes', async () => {
    const r = await call('POST', 'sync', { library: { list: [item(1, { title: 'x'.repeat(9999) })], __proto__: { polluted: 1 } } }, cookie)
    expect(r.body.library.list[0].title).toHaveLength(200)
    const huge = { list: Array.from({ length: 2000 }, (_, i) => item(i + 1, { title: 'x'.repeat(190) })) }
    expect((await call('POST', 'sync', { library: huge }, cookie)).status).toBe(413)
  })
  it('Supporter se queda con la fecha más antigua', async () => {
    await call('POST', 'sync', { library: {}, supporterSince: 2000 }, cookie)
    const r = await call('POST', 'sync', { library: {}, supporterSince: 5000 }, cookie)
    expect(r.body.supporterSince).toBe(2000)
  })
  it('un usuario no puede ver ni tocar la biblioteca de otro', async () => {
    await call('POST', 'sync', { library: { list: [item(1)] } }, cookie)
    const other = withCookie(await call('POST', 'register', { email: 'beto@mail.com', password: 'otra-clave-larga-2' }, {}, '3.3.3.3'))
    const me = await call('GET', 'me', undefined, other)
    expect(me.body.library.list).toEqual([])
  })
})

describe('verificación de mail', () => {
  it('confirma el mail con el token recibido (una sola vez)', async () => {
    await register()
    const { token } = mails[0]
    expect((await call('POST', 'verify', { token })).status).toBe(200)
    expect((await store.findUserByEmail('ana@mail.com')).emailVerified).toBe(true)
    expect((await call('POST', 'verify', { token })).status).toBe(400)      // ya usado
  })
  it('rechaza tokens inventados y vencidos', async () => {
    await register()
    expect((await call('POST', 'verify', { token: 'inventado' })).status).toBe(400)
    const { token } = mails[0]
    clock += 25 * 60 * 60_000
    expect((await call('POST', 'verify', { token })).status).toBe(400)
  })
  it('se puede pedir un mail nuevo', async () => {
    const reg = await register()
    const res = await call('POST', 'resend-verification', {}, withCookie(reg))
    expect(res.body.mailSent).toBe(true)
    expect(mails).toHaveLength(2)
  })
})

describe('recuperar contraseña', () => {
  beforeEach(async () => { await register(); mails.length = 0 })

  it('responde igual exista o no el mail, y solo manda mail si existe', async () => {
    const yes = await call('POST', 'forgot', { email: 'ana@mail.com' })
    const no = await call('POST', 'forgot', { email: 'nadie@mail.com' })
    expect(yes).toEqual(no)
    expect(mails).toHaveLength(1)
    expect(mails[0]).toMatchObject({ kind: 'reset', to: 'ana@mail.com' })
  })
  it('permite elegir una contraseña nueva y cierra todas las sesiones', async () => {
    const login = await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' })
    await call('POST', 'forgot', { email: 'ana@mail.com' })
    const { token } = mails[0]
    const r = await call('POST', 'reset', { token, password: 'clave-nueva-segura-9' })
    expect(r.status).toBe(200)
    expect((await call('GET', 'me', undefined, withCookie(login))).status).toBe(401)
    expect((await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' })).status).toBe(401)
    expect((await call('POST', 'login', { email: 'ana@mail.com', password: 'clave-nueva-segura-9' })).status).toBe(200)
    expect((await store.findUserByEmail('ana@mail.com')).emailVerified).toBe(true)
  })
  it('el enlace sirve una sola vez y vence en 1 hora', async () => {
    await call('POST', 'forgot', { email: 'ana@mail.com' })
    const { token } = mails[0]
    expect((await call('POST', 'reset', { token, password: 'clave-nueva-segura-9' })).status).toBe(200)
    expect((await call('POST', 'reset', { token, password: 'otra-clave-nueva-8' })).status).toBe(400)

    await call('POST', 'forgot', { email: 'ana@mail.com' }, {}, '8.8.8.8')
    clock += 61 * 60_000
    expect((await call('POST', 'reset', { token: mails[1].token, password: 'otra-clave-nueva-8' })).status).toBe(400)
  })
  it('rechaza contraseñas débiles en el reset', async () => {
    await call('POST', 'forgot', { email: 'ana@mail.com' })
    expect((await call('POST', 'reset', { token: mails[0].token, password: '123' })).body.error).toBe('password_short')
  })
  it('limita los pedidos de recuperación', async () => {
    for (let i = 0; i < 3; i++) await call('POST', 'forgot', { email: 'ana@mail.com' })
    expect(mails.length).toBe(3)
    await call('POST', 'forgot', { email: 'ana@mail.com' })
    expect(mails.length).toBe(3)                        // el 4.º no manda nada
  })
  it('sin servicio de mail igual responde ok (sin revelar nada)', async () => {
    api = createAuthApi({ store, mailer: null, now: () => clock })
    expect((await call('POST', 'forgot', { email: 'ana@mail.com' })).status).toBe(200)
  })
})

describe('cambiar contraseña y borrar cuenta', () => {
  it('cambia la contraseña y cierra las otras sesiones (no la actual)', async () => {
    const a = await register()
    const b = await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' }, {}, '4.4.4.4')
    const r = await call('POST', 'password', { current: 'una-clave-larga-1', next: 'clave-nueva-segura-9' }, withCookie(a))
    expect(r.status).toBe(200)
    expect((await call('GET', 'me', undefined, withCookie(a))).status).toBe(200)
    expect((await call('GET', 'me', undefined, withCookie(b))).status).toBe(401)
  })
  it('exige la contraseña actual', async () => {
    const a = await register()
    expect((await call('POST', 'password', { current: 'mal', next: 'clave-nueva-segura-9' }, withCookie(a))).status).toBe(401)
  })
  it('borra la cuenta y todos sus datos', async () => {
    const a = await register()
    const del = await call('POST', 'delete', { password: 'una-clave-larga-1' }, withCookie(a))
    expect(del.status).toBe(200)
    expect(await store.findUserByEmail('ana@mail.com')).toBeNull()
    expect((await call('GET', 'me', undefined, withCookie(a))).status).toBe(401)
    expect(await store.countSessions('1')).toBe(0)
  })
  it('no borra si la contraseña es incorrecta', async () => {
    const a = await register()
    expect((await call('POST', 'delete', { password: 'incorrecta' }, withCookie(a))).status).toBe(401)
    expect(await store.findUserByEmail('ana@mail.com')).not.toBeNull()
  })
})

describe('estado', () => {
  it('informa si hay servicio de mail', async () => {
    expect((await call('GET', 'status')).body).toEqual({ enabled: true, mail: true })
    api = createAuthApi({ store, mailer: null })
    expect((await call('GET', 'status')).body).toEqual({ enabled: true, mail: false })
  })
  it('un error interno no filtra detalles', async () => {
    const broken = { ...store, findUserByEmail: async () => { throw new Error('mongodb://usuario:clave@host explotó') } }
    api = createAuthApi({ store: broken, mailer: null })
    const res = await call('POST', 'login', { email: 'ana@mail.com', password: 'una-clave-larga-1' })
    expect(res.status).toBe(500)
    expect(JSON.stringify(res.body)).toBe('{"error":"server_error"}')
  })
})
