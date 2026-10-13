// ─────────────────────────────────────────────────────────────────────────
// Idiomas de la app (español / inglés), elegidos SOLOS según la persona y el lugar.
//
//  Orden de decisión (la primera que aplique):
//   1. Lo que la persona eligió a mano (selector ES | EN).
//   2. ?lang=en / ?lang=es en la dirección (útil para compartir y para probar).
//   3. El idioma del navegador (el primero que sea español o inglés).
//   4. Si el navegador está en otro idioma: el país (hispanohablante → español; el resto → inglés).
//   5. Español (idioma del proyecto).
//
// Cómo se traduce: el TEXTO EN ESPAÑOL es la clave. `tt('Mi lista')` devuelve "My list" en inglés (si está en el diccionario
// src/i18n/en.js) y, si falta una traducción, el mismo español (nunca se rompe nada ni se ve una clave rara).
// El idioma se fija al cargar la página; cambiarlo recarga (por eso `tt` puede usarse en cualquier parte, hasta fuera de React).
// ─────────────────────────────────────────────────────────────────────────
import EN from '../i18n/en.js'

export const LANGS = ['es', 'en']
export const DEFAULT_LANG = 'es'
const KEY = 'lifehigh:lang:v1'          // elección manual
const AUTO_KEY = 'lifehigh:lang:auto'   // resultado de la detección por país (para no repetirla)
const COUNTRY_KEY = 'lifehigh:country'

/** Países donde el español es el idioma principal. Cualquier otro país → inglés cuando el navegador no dice nada claro. */
export const SPANISH_COUNTRIES = new Set(['AR', 'BO', 'CL', 'CO', 'CR', 'CU', 'DO', 'EC', 'SV', 'GT', 'HN', 'MX', 'NI', 'PA', 'PY', 'PE', 'PR', 'UY', 'VE', 'ES', 'GQ'])

const primary = (tag) => String(tag || '').toLowerCase().split(/[-_]/)[0]

/** @returns {'es'|'en'|null} primer idioma de la lista del navegador que sea español o inglés */
export const fromBrowser = (list) => {
  for (const tag of list || []) { const p = primary(tag); if (p === 'es' || p === 'en') return p }
  return null
}

/** Decisión pura (se prueba sin navegador). */
export const pickLang = ({ stored, param, browser, country, auto } = {}) => {
  if (LANGS.includes(stored)) return stored
  if (LANGS.includes(param)) return param
  const b = fromBrowser(browser)
  if (b) return b
  if (LANGS.includes(auto)) return auto
  if (country) return SPANISH_COUNTRIES.has(String(country).toUpperCase()) ? 'es' : 'en'
  // Navegador en otro idioma y país desconocido: inglés es la mejor lengua puente fuera del mundo hispano,
  // pero sin ningún dato mantenemos el idioma del proyecto
  return DEFAULT_LANG
}

const safe = (fn, fallback = null) => { try { return fn() } catch { return fallback } }

const detect = () => {
  if (typeof window === 'undefined') return DEFAULT_LANG
  if (LANGS.includes(globalThis.__LH_LANG__)) return globalThis.__LH_LANG__             // pruebas
  return pickLang({
    stored: safe(() => localStorage.getItem(KEY)),
    param: safe(() => new URLSearchParams(window.location.search).get('lang')),
    browser: safe(() => (navigator.languages?.length ? navigator.languages : [navigator.language])),
    auto: safe(() => localStorage.getItem(AUTO_KEY)),
    country: safe(() => sessionStorage.getItem(COUNTRY_KEY)),
  })
}

let lang = detect()
export const getLang = () => lang
export const isEnglish = () => lang === 'en'

/** Reemplaza {nombre} por su valor. */
export const interpolate = (text, vars) =>
  (vars ? String(text).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text)

/** Traducción con idioma explícito (pura, para pruebas y para reutilizar). */
export const translate = (l, es, vars, dict = EN) => interpolate(l === 'en' ? (dict[es] ?? es) : es, vars)

/** Traduce un texto escrito en español al idioma actual. */
export const tt = (es, vars) => translate(lang, es, vars)

/** Elige a mano el idioma (se recuerda) y recarga para que todo cambie junto. */
export const setLang = (l) => {
  if (!LANGS.includes(l) || l === lang) return
  safe(() => localStorage.setItem(KEY, l))
  if (typeof window !== 'undefined') window.location.reload()
}

// Formatos según el idioma
export const locale = () => (lang === 'en' ? 'en-US' : 'es-AR')
export const tmdbLang = () => (lang === 'en' ? 'en-US' : 'es-MX')
export const fmtDate = (d, opts) => new Date(d).toLocaleDateString(locale(), opts)
export const fmtTime = (d, opts = { hour: '2-digit', minute: '2-digit' }) => new Date(d).toLocaleTimeString(locale(), opts)
export const fmtNumber = (n, opts) => new Intl.NumberFormat(locale(), opts).format(n)

/**
 * Afina el idioma por el PAÍS cuando el navegador no está en español ni en inglés (p. ej. francés o portugués).
 * Se hace una sola vez por pestaña, sin pedir permisos (el país lo informa nuestra propia API) y solo recarga si cambia el idioma.
 */
export const refineLangByCountry = async (fetchImpl = (typeof fetch !== 'undefined' ? fetch : null)) => {
  if (typeof window === 'undefined' || !fetchImpl) return
  if (globalThis.__LH_LANG__) return
  const manual = safe(() => localStorage.getItem(KEY)) || safe(() => new URLSearchParams(window.location.search).get('lang'))
  if (LANGS.includes(manual)) return
  const browser = safe(() => (navigator.languages?.length ? navigator.languages : [navigator.language]))
  if (fromBrowser(browser)) return                       // el navegador ya dice claramente cuál
  if (safe(() => localStorage.getItem(AUTO_KEY))) return // ya se resolvió antes
  try {
    const res = await fetchImpl('/api/geo', { cache: 'no-store' })
    const { country } = await res.json()
    if (!country) return
    safe(() => sessionStorage.setItem(COUNTRY_KEY, country))
    const next = pickLang({ browser, country })
    safe(() => localStorage.setItem(AUTO_KEY, next))
    if (next !== lang) window.location.reload()
  } catch { /* sin red: seguimos con el idioma actual */ }
}
