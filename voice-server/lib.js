// Lógica pura del servidor de voz (sin red): tokens, límites y manejo de salas. Se prueba desde el repositorio principal.
import crypto from 'node:crypto'

export const MAX_PEERS = 12
export const MAX_PAYLOAD = 16 * 1024
export const TOKEN_MAX_AGE_S = 300          // un token vale 5 minutos (se usa para abrir la conexión, no para mantenerla)

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const fromB64url = (s) => Buffer.from(s, 'base64url')

/** Firma un token HS256 { sub, handle, name, code, exp } (el mismo formato lo genera la API de Vercel). */
export const signToken = (payload, secret, now = Date.now()) => {
  const body = { ...payload, exp: Math.floor(now / 1000) + TOKEN_MAX_AGE_S }
  const head = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const data = `${head}.${b64url(JSON.stringify(body))}`
  const sig = b64url(crypto.createHmac('sha256', secret).update(data).digest())
  return `${data}.${sig}`
}

/** @returns {{ ok: true, claims } | { ok: false, reason: string }} */
export const verifyToken = (token, secret, now = Date.now()) => {
  if (!secret || typeof token !== 'string' || token.length > 2000) return { ok: false, reason: 'bad_token' }
  const parts = token.split('.')
  if (parts.length !== 3) return { ok: false, reason: 'bad_token' }
  const [head, body, sig] = parts
  const expected = crypto.createHmac('sha256', secret).update(`${head}.${body}`).digest()
  let given
  try { given = fromB64url(sig) } catch { return { ok: false, reason: 'bad_token' } }
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return { ok: false, reason: 'bad_signature' }
  let h, claims
  try { h = JSON.parse(fromB64url(head).toString()); claims = JSON.parse(fromB64url(body).toString()) } catch { return { ok: false, reason: 'bad_token' } }
  if (h.alg !== 'HS256') return { ok: false, reason: 'bad_alg' }
  if (!claims || typeof claims.exp !== 'number' || claims.exp * 1000 < now) return { ok: false, reason: 'expired' }
  if (typeof claims.sub !== 'string' || typeof claims.code !== 'string' || !/^[a-z0-9]{7}$/.test(claims.code)) return { ok: false, reason: 'bad_claims' }
  return { ok: true, claims }
}

/** Compara secretos sin filtrar información por el tiempo de respuesta. */
export const safeEqual = (a, b) => {
  const x = Buffer.from(String(a ?? '')), y = Buffer.from(String(b ?? ''))
  return x.length === y.length && crypto.timingSafeEqual(x, y)
}

/** Orígenes permitidos para conectarse (el navegador siempre manda Origin en un WebSocket). */
export const originAllowed = (origin, allowed) => !!origin && allowed.includes(origin)

/** Limitador simple por ventana (mensajes por socket). */
export const makeLimiter = (max, windowMs) => {
  let start = 0, count = 0
  return (now = Date.now()) => {
    if (now - start > windowMs) { start = now; count = 0 }
    count += 1
    return count <= max
  }
}

/** Estado de las salas de voz: code → Map(peerId → peer). */
export const createRooms = () => {
  const rooms = new Map()
  return {
    size: (code) => rooms.get(code)?.size || 0,
    peers: (code) => [...(rooms.get(code)?.values() || [])],
    get: (code, id) => rooms.get(code)?.get(id) || null,
    byUser: (code, userId) => [...(rooms.get(code)?.values() || [])].filter((p) => p.userId === userId),
    add(code, peer) {
      if (!rooms.has(code)) rooms.set(code, new Map())
      rooms.get(code).set(peer.id, peer)
    },
    remove(code, id) {
      const r = rooms.get(code)
      if (!r) return false
      const had = r.delete(id)
      if (!r.size) rooms.delete(code)
      return had
    },
    count: () => rooms.size,
  }
}

export const publicPeer = (p) => ({ id: p.id, handle: p.handle, name: p.name, muted: !!p.muted })

export const newId = () => crypto.randomBytes(9).toString('base64url')

/** ICE servers que se le entregan a cada cliente. TURN (opcional) se configura por variable para no exponerlo en el código. */
export const parseIceServers = (raw) => {
  const fallback = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
  if (!raw) return fallback
  try {
    const list = JSON.parse(raw)
    return Array.isArray(list) && list.length ? list : fallback
  } catch { return fallback }
}
