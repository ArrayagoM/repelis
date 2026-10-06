// Sesión (cookie) y rol "root" compartidos por la API de cuentas y la del panel del fundador.
import { sha256 } from './passwords.js'

export const COOKIE = 'lh_session'

export const parseCookies = (header = '') => {
  const out = {}
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=')
    if (i > 0) {
      try { out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()) } catch { /* cookie malformada */ }
    }
  }
  return out
}

/** Usuario de la sesión actual (o null). Borra sesiones vencidas. */
export const authenticateSession = async ({ store, headers, now = Date.now() }) => {
  const token = parseCookies(headers.cookie)[COOKIE]
  if (!token || token.length > 100) return null
  const id = sha256(token)
  const s = await store.getSession(id)
  if (!s) return null
  if (s.expiresAt <= now) { await store.deleteSession(id); return null }
  const user = await store.findUserById(s.userId)
  return user ? { user, sessionId: id } : null
}

/** "a@x.com, B@y.com" → ['a@x.com', 'b@y.com'] */
export const parseRootEmails = (value) =>
  String(value || '').split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes('@'))

/**
 * Root = el mail está en ROOT_EMAILS **y está verificado**.
 * Nunca se decide en el navegador: lo calcula el servidor en cada pedido.
 */
export const isRoot = (user, rootEmails = []) =>
  !!user && user.emailVerified === true && rootEmails.includes(String(user.email || '').toLowerCase())
