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
import { normalizeLibrary, mergeLibraries, emptyLibrary } from '../../src/lib/libraryMerge.js'

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

export const SESSION_TTL_MS = 30 * DAY
const VERIFY_TTL_MS = DAY
const RESET_TTL_MS = HOUR
const MAX_SESSIONS_PER_USER = 10
const MAX_LIBRARY_BYTES = 300_000
const COOKIE = 'lh_session'

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

const publicUser = (u) => ({
  id: u.id,
  email: u.email,
  name: u.name || '',
  emailVerified: !!u.emailVerified,
  supporterSince: u.supporterSince || null,
  createdAt: u.createdAt,
})

const parseCookies = (header = '') => {
  const out = {}
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

const buildCookie = (value, { maxAgeSec, secure }) =>
  `${COOKIE}=${value}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAgeSec}${secure ? '; Secure' : ''}`

/**
 * @param {{ store, mailer?: {sendVerify, sendReset}|null, secureCookies?: boolean, now?: () => number }} deps
 */
export const createAuthApi = ({ store, mailer = null, secureCookies = true, now = Date.now }) => {
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
  const authenticate = async (headers) => {
    const token = parseCookies(headers.cookie)[COOKIE]
    if (!token || token.length > 100) return null
    const id = sha256(token)
    const s = await store.getSession(id)
    if (!s) return null
    if (s.expiresAt <= now()) { await store.deleteSession(id); return null }
    const user = await store.findUserById(s.userId)
    return user ? { user, sessionId: id } : null
  }

  const sendVerification = async (user) => {
    if (!mailer) return false
    const token = newToken()
    await store.updateUser(user.id, { verifyHash: sha256(token), verifyExpires: now() + VERIFY_TTL_MS })
    try { await mailer.sendVerify(user.email, token); return true } catch { return false }
  }

  // ─── Acciones ─────────────────────────────────────────────────────────
  const actions = {
    'GET status': async () => ok({ enabled: true, mail: !!mailer }),

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
      return ok({ user: publicUser(user), library, mailSent }, [cookie])
    },

    'POST login': async ({ body, headers, ip }) => {
      const email = normalizeEmail(body.email)
      if (await limited(`login-ip:${ipKey(ip)}`, 20, 15 * MIN)) return fail(429, 'too_many_requests')
      if (email && await limited(`login-email:${sha256(email).slice(0, 24)}`, 8, 15 * MIN)) return fail(429, 'too_many_requests')

      const user = isValidEmail(email) && typeof body.password === 'string' && body.password.length <= 200
        ? await store.findUserByEmail(email) : null
      // Siempre hacemos un scrypt, exista o no el mail: la demora no revela si la cuenta existe
      const valid = await verifyPassword(String(body.password ?? '').slice(0, 200), user ? user.passHash : await dummyHash())
      if (!user || !valid) return fail(401, 'invalid_credentials')

      // Limitamos las sesiones abiertas por usuario (cada login nuevo)
      if ((await store.countSessions(user.id)) >= MAX_SESSIONS_PER_USER) await store.deleteSessionsOfUser(user.id)
      const cookie = await startSession(user.id, headers)
      return ok({ user: publicUser(user), library: normalizeLibrary(user.library) }, [cookie])
    },

    'POST logout': async ({ headers }) => {
      const auth = await authenticate(headers)
      if (auth) await store.deleteSession(auth.sessionId)
      return ok({ ok: true }, [clearCookie()])
    },

    'GET me': async ({ headers }) => {
      const auth = await authenticate(headers)
      if (!auth) return fail(401, 'not_authenticated')
      return ok({ user: publicUser(auth.user), library: normalizeLibrary(auth.user.library) })
    },

    // Sincroniza: fusiona la copia del dispositivo con la de la cuenta y devuelve el resultado
    'POST sync': async ({ body, headers }) => {
      const auth = await authenticate(headers)
      if (!auth) return fail(401, 'not_authenticated')
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
          try { await mailer.sendReset(user.email, token) } catch { /* no revelamos fallos al cliente */ }
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
      return ok()
    },

    'POST verify': async ({ body, ip }) => {
      if (await limited(`verify-ip:${ipKey(ip)}`, 20, HOUR)) return fail(429, 'too_many_requests')
      const token = typeof body.token === 'string' ? body.token : ''
      if (!token || token.length > 100) return fail(400, 'token_invalid')
      const user = await store.findUserByToken('verify', sha256(token), now())
      if (!user) return fail(400, 'token_invalid')
      await store.updateUser(user.id, { emailVerified: true, verifyHash: undefined, verifyExpires: undefined })
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
      if (!(await verifyPassword(String(body.current ?? '').slice(0, 200), auth.user.passHash))) return fail(401, 'invalid_credentials')
      const problem = passwordProblem(body.next, auth.user.email)
      if (problem) return fail(400, problem)
      await store.updateUser(auth.user.id, { passHash: await hashPassword(body.next) })
      await store.deleteSessionsOfUser(auth.user.id, auth.sessionId)   // cierra las demás sesiones
      return ok()
    },

    'POST delete': async ({ body, headers }) => {
      const auth = await authenticate(headers)
      if (!auth) return fail(401, 'not_authenticated')
      if (await limited(`del:${auth.user.id}`, 5, HOUR)) return fail(429, 'too_many_requests')
      if (!(await verifyPassword(String(body.password ?? '').slice(0, 200), auth.user.passHash))) return fail(401, 'invalid_credentials')
      await store.deleteUser(auth.user.id)
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
