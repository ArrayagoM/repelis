// Formatos del panel del fundador (puros y probados).

/** 0 → "0", 1234 → "1.234" */
export const fmtInt = (n) => new Intl.NumberFormat('es-AR').format(Math.round(Number(n) || 0))

/** Horas → "12,5 h" · menos de una hora → "42 min" */
export const fmtHours = (hours) => {
  const h = Number(hours) || 0
  if (h <= 0) return '0 min'
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(h)} h`
}

/** Minutos → "3,5 min" · "1 h 20 min" */
export const fmtMinutes = (min) => {
  const m = Number(min) || 0
  if (m <= 0) return '0 min'
  if (m < 60) return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(m)} min`
  return `${Math.floor(m / 60)} h ${Math.round(m % 60)} min`
}

/** Variación % para la etiqueta de cada KPI. */
export const fmtDelta = (pct) => {
  if (pct === null || pct === undefined || !Number.isFinite(pct)) return { text: 'sin datos previos', tone: 'flat' }
  if (pct === 0) return { text: '= que antes', tone: 'flat' }
  return { text: `${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%`, tone: pct > 0 ? 'up' : 'down' }
}

/** "AR" → "🇦🇷" */
export const flagEmoji = (cc) => {
  if (!/^[A-Z]{2}$/.test(cc || '')) return '🌐'
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

let regionNames = null
export const countryName = (cc) => {
  if (!/^[A-Z]{2}$/.test(cc || '')) return 'Desconocido'
  try { regionNames ||= new Intl.DisplayNames(['es'], { type: 'region' }); return regionNames.of(cc) || cc } catch { return cc }
}

export const PLATFORM_LABELS = {
  web: 'Navegador', pwa: 'App instalada (web)', 'android-app': 'App Android', 'ios-app': 'App iPhone',
  'desktop-app': 'App de escritorio', tv: 'Smart TV',
}
export const DEVICE_LABELS = { mobile: 'Celular', tablet: 'Tablet', desktop: 'Computadora' }
export const PAGE_LABELS = {
  home: 'Inicio', movie: 'Fichas de películas', tv: 'Fichas de series', search: 'Búsqueda', catalog: 'Catálogos y géneros',
  'mi-lista': 'Mi lista', cuenta: 'Cuenta', calendario: 'Calendario', cines: 'Cines', descargar: 'Descargas', legal: 'Legales', comunidad: 'Comunidad', salas: 'Salas', other: 'Otras',
}

/** Hace cuánto, en texto corto. */
export const ago = (ts, now = Date.now()) => {
  const s = Math.max(0, Math.round((now - ts) / 1000))
  if (s < 10) return 'recién'
  if (s < 60) return `hace ${s} s`
  const m = Math.round(s / 60)
  if (m < 60) return `hace ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `hace ${h} h`
  return `hace ${Math.round(h / 24)} d`
}

/** Rótulo de una fecha 'YYYY-MM-DD' → "6/10" */
export const shortDay = (iso) => { const [, m, d] = String(iso).split('-'); return `${Number(d)}/${Number(m)}` }
