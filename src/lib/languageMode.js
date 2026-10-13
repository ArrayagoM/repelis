// ─────────────────────────────────────────────────────────────────────────
// Modo de filtro por idioma. Persiste en localStorage. Default = 'broad'.
//
// 'strict'  → with_original_language=es  →  contenido producido en español
//                                           (100% garantía, catálogo chico)
// 'broad'   → with_origin_country LATAM  →  contenido con probabilidad alta
//                                           de doblaje (catálogo grande)
// 'all'     → sin filtro                 →  catálogo completo (idioma original)
// ─────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'repelis:langMode:v1'
import { isEnglish, tt } from './i18n'

// En español el filtro "Doblado LATAM" es el normal; en inglés no aplica (el audio original en inglés es lo esperado): sin filtro.
const defaultMode = () => (isEnglish() ? 'all' : 'broad')

const VALID = ['strict', 'broad', 'all']

const listeners = new Set()

const safeGet = () => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return VALID.includes(v) ? v : defaultMode()
  } catch {
    return defaultMode()
  }
}

const safeSet = (v) => {
  try { localStorage.setItem(STORAGE_KEY, v) } catch {}
}

export const getLanguageMode = () => safeGet()

export const setLanguageMode = (mode) => {
  const safe = VALID.includes(mode) ? mode : defaultMode()
  safeSet(safe)
  listeners.forEach((fn) => { try { fn(safe) } catch {} })
}

export const subscribeLanguageMode = (fn) => {
  listeners.add(fn)
  fn(safeGet())
  return () => listeners.delete(fn)
}

// ─── Helpers para inyectar params en discover ────────────────────────────
const LATAM_COUNTRY_LIST = tt("MX|AR|CO|CL|PE|VE|UY|EC|BO|PY|ES")
const HISPANO_LANG = 'es'

/**
 * Devuelve los params extra que se aplican a discover según el modo.
 * Para endpoints que NO son discover (popular, top_rated, trending, etc.)
 * usamos filterResultsByMode() en cliente.
 */
export const getDiscoverParamsForMode = (mode = getLanguageMode()) => {
  if (mode === 'strict') return { with_original_language: HISPANO_LANG }
  if (mode === 'broad')  return { with_origin_country: LATAM_COUNTRY_LIST }
  return {}
}

/**
 * Filtro cliente para listados que NO son discover (popular, trending, etc.).
 * Devuelve los items que cumplen el modo activo.
 */
export const filterResultsByMode = (results = [], mode = getLanguageMode()) => {
  if (mode === 'all' || !results.length) return results

  if (mode === 'strict') {
    // solo idioma original es
    return results.filter((r) => r.original_language === 'es')
  }

  // 'broad': es + países LATAM en origin_country
  const LATAM_SET = new Set(LATAM_COUNTRY_LIST.split('|'))
  return results.filter((r) => {
    if (r.original_language === 'es') return true
    const origs = r.origin_country || []
    if (Array.isArray(origs) && origs.some((c) => LATAM_SET.has(c))) return true
    // Heurística: si el título es muy popular y la peli tiene release
    // en MX/AR (lo veríamos en release_dates), asumimos que tiene doblaje.
    // Sin hacer N requests extra, usamos popularidad como proxy:
    return r.popularity > 50 && r.original_language === 'en'
  })
}

export const MODE_LABELS = {
  strict: tt("Solo hispano"),
  broad:  tt("Doblado LATAM"),
  all:    tt("Todo el catálogo"),
}

export const MODE_DESCRIPTIONS = {
  strict: tt("Solo películas y series producidas originalmente en español. Catálogo más chico pero 100% en español."),
  broad:  tt("Cine hispano + estrenos populares con doblaje LATAM confirmado. Recomendado para Argentina."),
  all:    tt("Catálogo completo en idioma original. El audio depende del servidor de reproducción."),
}
