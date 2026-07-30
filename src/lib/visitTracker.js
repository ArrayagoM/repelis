// Tracker de visitas + page views. El backend lee la geo de los headers
// de Vercel; nosotros mandamos path, referrer y si es la 1ª de la sesión.

const SESSION_KEY = 'repelis:visitTracked:v1'

// Normaliza acá también para no mandar rutas con ids infinitos.
const cleanPath = (p) => {
  if (!p) return '/'
  return p.replace(/[?#].*$/, '') || '/'
}

export const trackPageView = async (rawPath) => {
  try {
    // No trackeamos el panel admin (ensucia las métricas)
    const path = cleanPath(rawPath || (typeof location !== 'undefined' ? location.pathname : '/'))
    if (path.startsWith('/admin')) return

    const firstOfSession = !sessionStorage.getItem(SESSION_KEY)
    if (firstOfSession) sessionStorage.setItem(SESSION_KEY, '1')

    await fetch('/api/track', {
      method: 'POST',
      keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        path,
        referrer: firstOfSession && typeof document !== 'undefined' ? document.referrer : '',
        isVisit: firstOfSession,
      }),
    }).catch(() => {})
  } catch {}
}

// Compat: el nombre viejo sigue existiendo (llamado desde main.jsx).
export const trackVisitOnce = () => trackPageView()
