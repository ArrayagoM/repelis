// ─────────────────────────────────────────────────────────────────────────
// Cines: recomendamos ir al cine y mandamos a comprar la entrada al SITIO OFICIAL de cada cadena.
//
// Reglas (por seguridad de quien compra):
//  · solo dominios oficiales de la cadena, https, sin parámetros de afiliado ni de tracking
//  · Life High no vende entradas ni cobra comisión: solo recibe donaciones voluntarias
//  · el país se deduce de la zona horaria / idioma del dispositivo (sin llamadas a servicios de IP)
// ─────────────────────────────────────────────────────────────────────────

export const COUNTRIES = {
  AR: 'Argentina',
  MX: 'México',
  CL: 'Chile',
  CO: 'Colombia',
  PE: 'Perú',
  UY: 'Uruguay',
  PY: 'Paraguay',
  EC: 'Ecuador',
  BO: 'Bolivia',
  ES: 'España',
}

// Páginas oficiales de cada cadena (verificadas). Algunas rechazan bots (403) pero son el dominio oficial.
export const CHAINS = {
  AR: [
    { id: 'cinemark-ar', name: 'Cinemark', url: 'https://www.cinemark.com.ar' },
    { id: 'cinepolis-ar', name: 'Cinépolis', url: 'https://cinepolis.com/ar' },
    { id: 'showcase-ar', name: 'Showcase', url: 'https://www.todoshowcase.com' },
  ],
  MX: [
    { id: 'cinepolis-mx', name: 'Cinépolis', url: 'https://cinepolis.com/mx' },
    { id: 'cinemex-mx', name: 'Cinemex', url: 'https://cinemex.com' },
  ],
  CL: [
    { id: 'cinemark-cl', name: 'Cinemark', url: 'https://www.cinemark.cl' },
    { id: 'cinepolis-cl', name: 'Cinépolis', url: 'https://cinepolis.com/cl' },
  ],
  CO: [
    { id: 'cinecolombia-co', name: 'Cine Colombia', url: 'https://www.cinecolombia.com' },
    { id: 'cinemark-co', name: 'Cinemark', url: 'https://www.cinemark.com.co' },
    { id: 'cinepolis-co', name: 'Cinépolis', url: 'https://cinepolis.com.co' },
  ],
  PE: [
    { id: 'cinemark-pe', name: 'Cinemark', url: 'https://www.cinemark-peru.com' },
    { id: 'cineplanet-pe', name: 'Cineplanet', url: 'https://www.cineplanet.com.pe' },
  ],
  UY: [
    { id: 'movie-uy', name: 'Movie', url: 'https://www.movie.com.uy' },
    { id: 'life-uy', name: 'Life Cinemas', url: 'https://www.lifecinemas.com.uy' },
  ],
  PY: [{ id: 'cinemark-py', name: 'Cinemark', url: 'https://www.cinemark.com.py' }],
  EC: [{ id: 'cinemark-ec', name: 'Cinemark', url: 'https://cinemark.com.ec' }],
  BO: [{ id: 'cinemark-bo', name: 'Cinemark', url: 'https://www.cinemark.com.bo' }],
  ES: [
    { id: 'cinesa-es', name: 'Cinesa', url: 'https://www.cinesa.es' },
    { id: 'yelmo-es', name: 'Yelmo', url: 'https://www.yelmocines.es' },
  ],
}

// ─── ¿Está en cines? ────────────────────────────────────────────────────
const DAY = 86400000
export const IN_THEATERS_DAYS = 70    // una película suele estar ~10 semanas en cartelera
export const PRESALE_DAYS = 21        // la preventa de entradas abre unas semanas antes

/** 'now' (en cartelera) | 'presale' (preventa) | null. Solo películas con fecha confirmada. */
export const theaterStatus = (item, now = Date.now()) => {
  const str = item?.release_date || item?.date
  if (!str) return null
  const t = new Date(str).getTime()
  if (Number.isNaN(t)) return null
  const diff = t - now
  if (diff > PRESALE_DAYS * DAY) return null
  if (diff > DAY) return 'presale'
  return diff >= -IN_THEATERS_DAYS * DAY ? 'now' : null
}

// ─── País del usuario ───────────────────────────────────────────────────
const COUNTRY_KEY = 'lifehigh:country:v1'

const TZ_EXACT = {
  'America/Buenos_Aires': 'AR',
  'America/Mexico_City': 'MX', 'America/Monterrey': 'MX', 'America/Tijuana': 'MX', 'America/Cancun': 'MX',
  'America/Merida': 'MX', 'America/Chihuahua': 'MX', 'America/Hermosillo': 'MX', 'America/Mazatlan': 'MX',
  'America/Santiago': 'CL', 'America/Punta_Arenas': 'CL',
  'America/Bogota': 'CO', 'America/Lima': 'PE', 'America/Montevideo': 'UY', 'America/Asuncion': 'PY',
  'America/Guayaquil': 'EC', 'America/La_Paz': 'BO',
  'Europe/Madrid': 'ES', 'Atlantic/Canary': 'ES',
}

export const countryFromTimezone = (tz) => {
  if (!tz) return null
  if (tz.startsWith('America/Argentina/')) return 'AR'
  return TZ_EXACT[tz] || null
}

export const countryFromLocale = (locale) => {
  const m = /^[a-z]{2,3}[-_]([A-Za-z]{2})\b/.exec(locale || '')
  const code = m ? m[1].toUpperCase() : null
  return code && COUNTRIES[code] ? code : null
}

export const getStoredCountry = () => {
  try { const c = localStorage.getItem(COUNTRY_KEY); return c && COUNTRIES[c] ? c : null } catch { return null }
}
export const setStoredCountry = (code) => {
  try { if (COUNTRIES[code]) localStorage.setItem(COUNTRY_KEY, code); else localStorage.removeItem(COUNTRY_KEY) } catch { /* sin storage */ }
  listeners.forEach((fn) => fn())
}

const listeners = new Set()
export const subscribeCountry = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }

/** Elegido por el usuario > zona horaria > idioma del navegador. null si no se puede saber. */
export const detectCountry = () => {
  const stored = getStoredCountry()
  if (stored) return stored
  let tz = null
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone } catch { /* sin Intl */ }
  return countryFromTimezone(tz) || countryFromLocale(typeof navigator !== 'undefined' ? navigator.language : '')
}

export const chainsFor = (country) => CHAINS[country] || []
