// ─────────────────────────────────────────────────────────────────────────
// API de cuentas (registro, login, sesión, sincronización, recuperación).
// Es una función pura de (request) → (response): no depende de Vercel ni de Mongo,
// así se prueba entera con el almacenamiento en memoria.
//
// Seguridad (resumen):
//  · contraseñas con scrypt; en la base solo hay hashes
//  · sesión = token aleatorio en cookie HttpOnly/Secure/SameSite=Lax; en la base solo su hash (revocable)
//  · POST solo JSON y del mismo origen (anti-CSRF); sin CORS
//  · límite de intentos por IP y por cuenta; mismas respuestas y mismo tiempo para mail inexistente
//  · recuperación/verificación con tokens de un solo uso que vencen
// ─────────────────────────────────────────────────────────────────────────
import { hashPassword, verifyPassword, dummyHash, newToken, sha256 } from './passwords.js'
import { withSeenDay } from './retention.js'
import { dayKey } from './pulse.js'
import { COOKIE, authenticateSession, isRoot } from './session.js'
import { normalizeLibrary, mergeLibraries, emptyLibrary } from '../../src/lib/libraryMerge.js'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const SESSION_TTL_MS = 30 * DAY
const VERIFY_TTL_MS = DAY
const RESET_TTL_MS = HOUR
const MAX_SESSIONS_PER_USER = 10
const MAX_LIBRARY_BYTES = 300_000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const WEAK = new Set(['12345678', '123456789', '1234567890', '11111111', '00000000', 'password', 'password1', 'qwertyui', 'qwerty123', 'contraseña', 'contrasena', 'abcd1234', 'iloveyou', '87654321'])

export const normalizeEmail = (e) => String(e ?? '').trim().toLowerCase()
export const isValidEmail = (e) => typeof e === 'string' && e.length <= 254 && EMAIL_RE.test(e)
const cleanName = (n) => String(n ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, 60)

/** Devuelve un código de error o null si la contraseña es aceptable. */
export const passwordProblem = (pw, email = '') => {
  if (typeof pw !== 'string') return 'password_invalid'
  if (pw.length < 8) return 'password_short'
  if (pw.length > 200) return 'password_long'
  if (WEAK.has(pw.toLowerCase()) || (email && pw.toLowerCase() === email)) return 'password_weak'
  return null
}

const publicUser = (u, root = false) => ({
  id: u.id,
  email: u.email,
  name: u.name || '',
  emailVerified: !!u.emailVerified,
  supporterSince: u.supporterSince || null,
  createdAt: u.createdAt,
  hasPassword: !!u.passHash,     // las cuentas creadas con Google no tienen contraseña
  google: !!u.googleSub,
  premium: !!u.premium,          // plan Premium (límites de la comunidad)
  root,                          // fundador: ve el panel de estadísticas (decidido por el servidor)
})

const buildCookie = (value, { maxAgeSec, secure }) =>
  `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`

/**
 * @param {{ store, mailer?: {sendVerify, sendReset}|null, secureCookies?: boolean, now?: () => number }} deps
 */
export const createAuthApi = ({ store, mailer = null, secureCookies = true, now = Date.now, googleClientId = '', verifyGoogle = null, rootEmails = [], onUserDeleted = null }) => {
  const reply = (status, body, cookies) => ({ status, body, cookies })
  const fail = (status, error) => reply(status, { error })
  const ok = (body = { ok: true }, cookies) => reply(200, body, cookies)

  const ipKey = (ip) => sha256(ip || 'unknown').slice(0, 24)

  /** true si ya superó el límite (cuenta este intento). */
  const limited = async (key, max, windowMs) => (await store.hit(key, windowMs, now())) > max

  const sameOrigin = (headers) => {
    const site = headers['sec-fetch-site']
    if (site && site !== 'same-origin' && site !== 'none') return false
    const origin = headers.origin
    if (!origin) return true
    const host = headers['x-forwarded-host'] || headers.host
    try { return new URL(origin).host === host } catch { return false }
  }

  const startSession = async (userId, headers) => {
    const token = newToken()
    const t = now()
    await store.createSession({
      id: sha256(token), userId, ua: String(headers['user-agent'] || '').slice(0, 200),
      createdAt: t, expiresAt: t + SESSION_TTL_MS,
    })
    return buildCookie(token, { maxAgeSec: Math.floor(SESSION_TTL_MS / 1000), secure: secureCookies })
  }

  const clearCookie = () => buildCookie('', { maxAgeSec: 0, secure: secureCookies })

  /** Usuario de la sesión actual (o null). Borra sesiones vencidas. */
  const authenticate = (headers) => authenticateSession({ store, headers, now: now() })
  const pub = (u) => publicUser(u, isRoot(u, rootEmails))

  /** Anota que hoy esta persona abrió la app (una escritura por día como máximo). Alimenta la retención del panel. */
  const touchActivity = async (user) => {
    try {
      const patch = withSeenDay(user, dayKey(now()))
      if (patch) { await store.updateUser(user.id, patch); Object.assign(user, patch) }
    } catch { /* la retención nunca debe romper el ingreso */ }
  }

  /** Mails informativos (bienvenida, avisos de seguridad): nunca rompen la acción principal. */
  const notify = async (method, user, extra = {}) => {
    if (!mailer?.[method]) return
    try { await mailer[method](user.email, { name: user.name, ...extra }) } catch (e) { console.error(`[auth] mail ${method} falló:`, e?.message) }
  }

  const sendVerification = async (user) => {
    if (!mailer) return false
    const token = newToken()
    await store.updateUser(user.id, { verifyHash: sha256(token), verifyExpires: now() + VERIFY_TTL_MS })
    try { await mailer.sendVerify(user.email, token, { name: user.name }); return true } catch { return false }
  }

  /** Confirma que quien pide una acción delicada es el dueño: contraseña, o credencial de Google reciente. */
  const confirmIdentity = async (user, body) => {
    if (user.passHash && typeof body.password === 'string' && body.password) {
      return verifyPassword(body.password.slice(0, 200), user.passHash)
    }
    if (user.googleSub && typeof body.credential === 'string' && verifyGoogle) {
      try { return (await verifyGoogle(body.credential)).sub === user.googleSub } catch { return false }
    }
    return false
  }

  // ─── Acciones ─────────────────────────────────────────────────────────
  const actions = {
    'GET status': async () => ok({ enabled: true, mail: !!mailer, googleClientId: googleClientId && verifyGoogle ? googleClientId : null }),

    'POST register': async ({ body, headers, ip }) => {
      if (await limited(`reg:${ipKey(ip)}`, 5, HOUR)) return fail(429, 'too_many_requests')
      const email = normalizeEmail(body.email)
      if (!isValidEmail(email)) return fail(400, 'email_invalid')
      const problem = passwordProblem(body.password, email)
      if (problem) return fail(400, problem)

      const library = mergeLibraries(emptyLibrary(), normalizeLibrary(body.library), { now: now() })
      let user
      try {
        user = await store.createUser({
          email,
          name: cleanName(body.name),
          passHash: await hashPassword(body.password),
          emailVerified: false,
          createdAt: now(),
          library,
          libraryUpdatedAt: now(),
        })
      } catch (e) {
        if (e?.code === 'email_taken') return fail(409, 'email_taken')
        throw e
      }
      const cookie = await startSession(user.id, headers)
      const mailSent = await sendVerification(user)
      return ok({ user: pub(user), library, mailSent }, [cookie])
    },

    'POST login': async ({ body, headers, ip }) => {
      const email = normalizeEmail(body.email)
      if (await limited(`login-ip:${ipKey(ip)}`, 20, 15 * MIN)) return fail(429, 'too_many_requests')
      if (email && await limited(`login-email:${sha256(email).slice(0, 24)}`, 8, 15 * MIN)) return fail(429, 'too_many_requests')

      const user = isValidEmail(email) && typeof body.password === 'string' && body.password.length <= 200
        ? await store.findUserByEmail(email) : null
      // Siempre hacemos un scrypt, exista o no el mail: la demora no revela si la cuenta existe
      const hash = user?.passHash || await dummyHash()
      const valid = await verifyPassword(String(body.password ?? '').slice(0, 200), hash)
      if (!user || !user.passHash || !valid) return fail(401, 'invalid_credentials')

      // Limitamos las sesiones abiertas por usuario (cada login nuevo)
      if ((await store.countSessions(user.id)) >= MAX_SESSIONS_PER_USER) await store.deleteSessionsOfUser(user.id)
      const cookie = await startSession(user.id, headers)
      return ok({ user: pub(user), library: normalizeLibrary(user.library) }, [cookie])
    },

    // Ingreso / registro con Google (si el mail ya tenía cuenta, se vincula)
    'POST google': async ({ body, headers, ip }) => {
      if (!verifyGoogle || !googleClientId) return fail(503, 'google_unavailable')
      if (await limited(`google:${ipKey(ip)}`, 30, 15 * MIN)) return fail(429, 'too_many_requests')

      let g
      try { g = await verifyGoogle(body.credential) } catch { return fail(401, 'google_invalid') }

      let user = await store.findUserByGoogleSub(g.sub)
      let created = false
      if (!user) {
        const byEmail = await store.findUserByEmail(g.email)
        if (byEmail) {
          // Vincula Google a la cuenta existente. Si ese mail NUNCA se había verificado, quien creó la cuenta
          // pudo no ser el dueño del mail (pre-secuestro): borramos su contraseña y sus sesiones.
          const patch = { googleSub: g.sub, emailVerified: true, name: byEmail.name || cleanName(g.name) }
          if (!byEmail.emailVerified) patch.passHash = undefined
          user = await store.updateUser(byEmail.id, patch)
          if (!byEmail.emailVerified) await store.deleteSessionsOfUser(byEmail.id)
        } else {
          try {
            user = await store.createUser({
              email: g.email, name: cleanName(g.name), googleSub: g.sub, emailVerified: true,
              createdAt: now(), library: mergeLibraries(emptyLibrary(), normalizeLibrary(body.library), { now: now() }), libraryUpdatedAt: now(),
            })
            created = true
          } catch (e) {
            if (e?.code !== 'email_taken') throw e
            user = await store.findUserByEmail(g.email)       // carrera: se registró justo en paralelo
          }
        }
      }
      if (!user) return fail(500, 'server_error')

      if ((await store.countSessions(user.id)) >= MAX_SESSIONS_PER_USER) await store.deleteSessionsOfUser(user.id)
      const cookie = await startSession(user.id, headers)
      if (created) await notify('sendWelcome', user)
      return ok({ user: pub(user), library: normalizeLibrary(user.library), created }, [cookie])
    },

    'POST logout': async ({ headers }) => {
      const auth = await authenticate(headers)
      if (auth) await store.deleteSession(auth.sessionId)
      return ok({ ok: true }, [clearCookie()])
    },

    'GET me': async ({ headers }) => {
      const auth = await authenticate(headers)
      if (!auth) return fail(401, 'not_authenticated')
      await touchActivity(auth.user)
      return ok({ user: pub(auth.user), library: normalizeLibrary(auth.user.library) })
    },

    // Sincroniza: fusiona la copia del dispositivo con la de la cuenta y devuelve el resultado
    'POST sync': async ({ body, headers }) => {
      const auth = await authenticate(headers)
      if (!auth) return fail(401, 'not_authenticated')
      await touchActivity(auth.user)
      if (JSON.stringify(body.library ?? null).length > MAX_LIBRARY_BYTES) return fail(413, 'library_too_large')

      const merged = mergeLibraries(body.library, auth.user.library, { now: now() })
      const patch = { library: merged, libraryUpdatedAt: now() }
      // "Supporter": se queda con la fecha más antigua entre dispositivo y cuenta
      const clientSince = Number(body.supporterSince) || null
      const since = [auth.user.supporterSince, clientSince].filter(Boolean)
      if (since.length) patch.supporterSince = Math.min(...since)
      const saved = await store.updateUser(auth.user.id, patch)
      return ok({ library: merged, supporterSince: saved?.supporterSince || null, updatedAt: patch.libraryUpdatedAt })
    },

    'POST forgot': async ({ body, ip }) => {
      if (await limited(`forgot-ip:${ipKey(ip)}`, 5, HOUR)) return fail(429, 'too_many_requests')
      const email = normalizeEmail(body.email)
      if (isValidEmail(email) && !(await limited(`forgot-email:${sha256(email).slice(0, 24)}`, 3, HOUR))) {
        const user = await store.findUserByEmail(email)
        if (user && mailer) {
          const token = newToken()
          await store.updateUser(user.id, { resetHash: sha256(token), resetExpires: now() + RESET_TTL_MS })
          try { await mailer.sendReset(user.email, token, { name: user.name }) } catch { /* no revelamos fallos al cliente */ }
        }
      }
      return ok()   // siempre lo mismo: no revela si el mail existe
    },

    'POST reset': async ({ body, ip }) => {
      if (await limited(`reset-ip:${ipKey(ip)}`, 10, HOUR)) return fail(429, 'too_many_requests')
      const token = typeof body.token === 'string' ? body.token : ''
      if (!token || token.length > 100) return fail(400, 'token_invalid')
      const user = await store.findUserByToken('reset', sha256(token), now())
      if (!user) return fail(400, 'token_invalid')
      const problem = passwordProblem(body.password, user.email)
      if (problem) return fail(400, problem)

      await store.updateUser(user.id, {
        passHash: await hashPassword(body.password),
        resetHash: undefined, resetExpires: undefined,
        emailVerified: true,          // recibió el mail: demostró que es suyo
      })
      await store.deleteSessionsOfUser(user.id)   // cierra todas las sesiones abiertas
      await notify('sendPasswordChanged', user)
      return ok()
    },

    'POST verify': async ({ body, ip }) => {
      if (await limited(`verify-ip:${ipKey(ip)}`, 20, HOUR)) return fail(429, 'too_many_requests')
      const token = typeof body.token === 'string' ? body.token : ''
      if (!token || token.length > 100) return fail(400, 'token_invalid')
      const user = await store.findUserByToken('verify', sha256(token), now())
      if (!user) return fail(400, 'token_invalid')
      const wasVerified = user.emailVerified === true
      await store.updateUser(user.id, { emailVerified: true, verifyHash: undefined, verifyExpires: undefined })
      if (!wasVerified) await notify('sendWelcome', user)
      return ok()
    },

    'POST resend-verification': async ({ headers }) => {
      const auth = await authenticate(headers)
      if (!auth) return fail(401, 'not_authenticated')
      if (auth.user.emailVerified) return ok({ ok: true, alreadyVerified: true })
      if (await limited(`resend:${auth.user.id}`, 3, HOUR)) return fail(429, 'too_many_requests')
      if (!mailer) return fail(503, 'mail_unavailable')
      return ok({ ok: true, mailSent: await sendVerification(auth.user) })
    },

    'POST password': async ({ body, headers }) => {
      const auth = await authenticate(headers)
      if (!auth) return fail(401, 'not_authenticated')
      if (await limited(`pw:${auth.user.id}`, 10, HOUR)) return fail(429, 'too_many_requests')
      if (!auth.user.passHash) return fail(400, 'no_password')
      if (!(await verifyPassword(String(body.current ?? '').slice(0, 200), auth.user.passHash))) return fail(401, 'invalid_credentials')
      const problem = passwordProblem(body.next, auth.user.email)
      if (problem) return fail(400, problem)
      await store.updateUser(auth.user.id, { passHash: await hashPassword(body.next) })
      await store.deleteSessionsOfUser(auth.user.id, auth.sessionId)   // cierra las demás sesiones
      await notify('sendPasswordChanged', auth.user)
      return ok()
    },

    'POST delete': async ({ body, headers }) => {
      const auth = await authenticate(headers)
      if (!auth) return fail(401, 'not_authenticated')
      if (await limited(`del:${auth.user.id}`, 5, HOUR)) return fail(429, 'too_many_requests')
      if (!(await confirmIdentity(auth.user, body))) return fail(401, 'invalid_credentials')
      await store.deleteUser(auth.user.id)
      await notify('sendAccountDeleted', auth.user)
      // Lo que la persona publicó en la comunidad se borra con su cuenta (si falla, la cuenta ya no existe igual)
      try { await onUserDeleted?.(auth.user.id) } catch (e) { console.error('[auth] no se pudo limpiar la comunidad:', e?.message) }
      return ok({ ok: true }, [clearCookie()])
    },
  }

  /**
   * @param {{ method: string, action: string, headers: Record<string,string>, body?: any, ip?: string }} req
   * @returns {Promise<{ status: number, body: object, cookies?: string[] }>}
   */
  return async (req) => {
    const method = String(req.method || '').toUpperCase()
    const handler = actions[`${method} ${req.action}`]
    if (!handler) return fail(method === 'GET' || method === 'POST' ? 404 : 405, 'not_found')

    const headers = Object.fromEntries(Object.entries(req.headers || {}).map(([k, v]) => [k.toLowerCase(), v]))
    let body = {}
    if (method === 'POST') {
      if (!sameOrigin(headers)) return fail(403, 'forbidden')
      if (!String(headers['content-type'] || '').toLowerCase().includes('application/json')) return fail(415, 'json_required')
      body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    }
    try {
      return await handler({ body, headers, ip: req.ip })
    } catch (e) {
      // Nunca devolvemos detalles internos al cliente
      console.error('[auth]', req.action, e?.message)
      return fail(500, 'server_error')
    }
  }
}
