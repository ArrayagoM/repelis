// Contraseñas y tokens con el módulo crypto de Node (sin dependencias).
// scrypt es un hash lento a propósito: si roban la base, probar contraseñas sale caro.

import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const N = 16384   // costo de CPU/memoria (≈16 MB y ~50 ms por hash)
const R = 8
const P = 1
const KEYLEN = 64
const MAXMEM = 64 * 1024 * 1024

export const hashPassword = async (password) => {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM })
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`
}

/** Compara en tiempo constante. Devuelve false (nunca lanza) ante un formato raro. */
export const verifyPassword = async (password, stored) => {
  try {
    const [algo, n, r, p, saltB64, keyB64] = String(stored).split('$')
    if (algo !== 'scrypt') return false
    const salt = Buffer.from(saltB64, 'base64')
    const expected = Buffer.from(keyB64, 'base64')
    // Un hash sin sal o con clave corta/vacía NUNCA debe validar (compararía buffers vacíos = "true")
    if (salt.length < 8 || expected.length < 32) return false
    // Acotamos los parámetros que vienen de la base para que un dato alterado no agote la memoria
    const params = { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM }
    if (!(params.N >= 1024 && params.N <= 65536) || !(params.r >= 1 && params.r <= 16) || !(params.p >= 1 && params.p <= 4)) return false
    const actual = await scryptAsync(password, salt, expected.length, params)
    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

/** Token aleatorio para sesiones, verificación de mail y recuperación (256 bits). */
export const newToken = () => randomBytes(32).toString('base64url')

/** En la base guardamos solo el hash del token: si la base se filtra, los tokens no sirven. */
export const sha256 = (value) => createHash('sha256').update(String(value)).digest('hex')

let dummy = null
/** Hash falso para gastar el mismo tiempo cuando el mail no existe (evita adivinar mails por la demora). */
export const dummyHash = () => (dummy ||= hashPassword('contraseña-que-nadie-usa'))
