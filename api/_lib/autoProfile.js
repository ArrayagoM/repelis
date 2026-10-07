// Perfil automático: para entrar a una sala, comentar o armar una lista NO hay que llenar ningún formulario.
// La primera vez se crea un perfil con un @usuario generado a partir del nombre de la cuenta (único); se puede cambiar cuando se quiera en /perfil.
import { HANDLE_RE, handleProblem, cleanText } from '../../src/lib/socialRules.js'

const strip = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

/** Base del @usuario: el nombre sin acentos ni símbolos (máx. 14 letras). Nunca usa el mail. */
export const handleBase = (name) => {
  const base = strip(name).slice(0, 14).replace(/_+$/, '')
  return base.length >= 3 && !handleProblem(base) ? base : 'cinefilo'
}

/**
 * Elige un @usuario libre: primero el nombre limpio; si está ocupado, con un número al final.
 * @param {string} name
 * @param {(handle: string) => Promise<boolean>} isTaken
 * @param {() => number} rand
 */
export const pickHandle = async (name, isTaken, rand = Math.random) => {
  const base = handleBase(name)
  if (!(await isTaken(base))) return base
  for (let i = 0; i < 12; i++) {
    const digits = i < 6 ? 2 + (i >> 1) : 4          // 2, 2, 3, 3, 4, 4 dígitos y luego 4
    const n = String(Math.floor(rand() * 10 ** digits)).padStart(digits, '0')
    const h = `${base.slice(0, 20 - digits - 1)}_${n}`
    if (HANDLE_RE.test(h) && !handleProblem(h) && !(await isTaken(h))) return h
  }
  return `${base.slice(0, 10)}_${Date.now().toString(36).slice(-6)}`
}

/**
 * Devuelve el perfil de la persona; si no tiene, lo crea. Seguro ante carreras (dos pedidos a la vez).
 * @returns {Promise<object>} perfil
 */
export const ensureProfile = async (social, user, now = Date.now(), rand = Math.random) => {
  const existing = await social.getProfile(user.id)
  if (existing) return existing
  const name = cleanText(user.name, 40)
  for (let attempt = 0; attempt < 4; attempt++) {
    const handle = await pickHandle(name, async (h) => !!(await social.getProfileByHandle(h)), rand)
    try {
      return await social.createProfile({ userId: user.id, handle, name: name || handle, bio: '', createdAt: now, handleChangedAt: 0 })
    } catch (e) {
      if (e?.code !== 'handle_taken') throw e
      const again = await social.getProfile(user.id)          // otro pedido nuestro ya lo creó
      if (again) return again
    }
  }
  throw new Error('no se pudo crear el perfil')
}
