// Verificación del "Sign in with Google" SIN dependencias ni secretos.
// El navegador recibe de Google un ID token firmado (JWT, RS256). Acá comprobamos:
//   firma (con las claves públicas de Google) · emisor · audiencia (NUESTRO client id) · vencimiento · mail verificado.
// Solo hace falta el Client ID (que es público); no existe "client secret" en este flujo.

import { createPublicKey, createVerify } from 'node:crypto'

export const JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])
const MAX_TOKEN_CHARS = 4096
const CLOCK_SKEW_MS = 5 * 60_000
const DEFAULT_KEYS_TTL_MS = 60 * 60_000

const fail = (code) => Object.assign(new Error(code), { code })
const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))

let keysCache = { keys: null, expiresAt: 0 }

/** Claves públicas de Google (cacheadas según el Cache-Control de la respuesta). */
export const getGoogleKeys = async ({ fetchImpl = fetch, now = Date.now() } = {}) => {
  if (keysCache.keys && keysCache.expiresAt > now) return keysCache.keys
  const res = await fetchImpl(JWKS_URL)
  if (!res.ok) throw fail('google_keys_unavailable')
  const { keys } = await res.json()
  if (!Array.isArray(keys) || !keys.length) throw fail('google_keys_unavailable')
  const maxAge = /max-age=(\d+)/.exec(res.headers?.get?.('cache-control') || '')
  keysCache = { keys, expiresAt: now + (maxAge ? Number(maxAge[1]) * 1000 : DEFAULT_KEYS_TTL_MS) }
  return keys
}

export const __clearGoogleKeysCache = () => { keysCache = { keys: null, expiresAt: 0 } }

/**
 * @returns {{ sub: string, email: string, name: string, picture: string|null }}
 * @throws Error con code 'google_invalid' si algo no cuadra
 */
export const verifyGoogleIdToken = (idToken, { clientId, keys, now = Date.now() }) => {
  try {
    if (!clientId) throw fail('google_not_configured')
    if (typeof idToken !== 'string' || idToken.length > MAX_TOKEN_CHARS) throw fail('google_invalid')
    const parts = idToken.split('.')
    if (parts.length !== 3) throw fail('google_invalid')

    const header = decode(parts[0])
    if (header.alg !== 'RS256') throw fail('google_invalid')          // nada de "alg: none" ni HS256
    const jwk = (keys || []).find((k) => k.kid === header.kid && k.kty === 'RSA')
    if (!jwk) throw fail('google_invalid')

    const signature = Buffer.from(parts[2], 'base64url')
    const valid = createVerify('RSA-SHA256')
      .update(`${parts[0]}.${parts[1]}`)
      .verify(createPublicKey({ key: jwk, format: 'jwk' }), signature)
    if (!valid) throw fail('google_invalid')

    const p = decode(parts[1])
    if (!ISSUERS.has(p.iss)) throw fail('google_invalid')
    if (p.aud !== clientId) throw fail('google_invalid')             // el token tiene que ser PARA nuestra app
    if (!(Number(p.exp) * 1000 > now)) throw fail('google_invalid')  // vencido
    if (Number(p.iat) * 1000 > now + CLOCK_SKEW_MS) throw fail('google_invalid')
    if (typeof p.sub !== 'string' || !p.sub) throw fail('google_invalid')
    if (typeof p.email !== 'string' || !p.email.includes('@')) throw fail('google_invalid')
    if (p.email_verified !== true) throw fail('google_invalid')      // mail sin verificar = no confiable

    return { sub: p.sub, email: p.email.toLowerCase(), name: String(p.name || '').slice(0, 60), picture: typeof p.picture === 'string' ? p.picture : null }
  } catch (e) {
    if (e?.code === 'google_not_configured') throw e
    throw fail('google_invalid')
  }
}
