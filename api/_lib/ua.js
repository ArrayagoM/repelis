// Parser mínimo de User-Agent para el edge function.
// Devuelve device (mobile/tablet/desktop), os y browser.

export const parseUA = (ua = '') => {
  const s = ua.toLowerCase()

  // Device
  let device = 'desktop'
  if (/ipad|tablet|(android(?!.*mobile))|kindle|silk|playbook/.test(s)) device = 'tablet'
  else if (/mobi|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/.test(s)) device = 'mobile'

  // OS
  let os = 'Otro'
  if (/windows nt/.test(s)) os = 'Windows'
  else if (/iphone|ipad|ipod|ios/.test(s)) os = 'iOS'
  else if (/mac os x|macintosh/.test(s)) os = 'macOS'
  else if (/android/.test(s)) os = 'Android'
  else if (/cros/.test(s)) os = 'ChromeOS'
  else if (/linux/.test(s)) os = 'Linux'

  // Browser (orden importa: Edge y Samsung antes que Chrome)
  let browser = 'Otro'
  if (/edg\//.test(s)) browser = 'Edge'
  else if (/samsungbrowser/.test(s)) browser = 'Samsung Internet'
  else if (/opr\/|opera/.test(s)) browser = 'Opera'
  else if (/firefox|fxios/.test(s)) browser = 'Firefox'
  else if (/chrome|crios|chromium/.test(s)) browser = 'Chrome'
  else if (/safari/.test(s)) browser = 'Safari'

  return { device, os, browser }
}

// Normaliza el host de un referrer, descartando el propio dominio y vacíos.
export const referrerHost = (referrer, selfHost = '') => {
  if (!referrer) return null
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, '')
    if (!h) return null
    if (selfHost && h === selfHost.replace(/^www\./, '')) return null   // navegación interna
    return h
  } catch {
    return null
  }
}
