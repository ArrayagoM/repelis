// Tracker de visitas — llama /api/track una vez por sesión.
// El endpoint server-side lee la geo de los headers de Vercel (no acá).

const SESSION_KEY = 'repelis:visitTracked:v1'

export const trackVisitOnce = async () => {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return  // ya trackeado esta sesión
    sessionStorage.setItem(SESSION_KEY, '1')

    await fetch('/api/track', {
      method: 'POST',
      keepalive: true,                       // sobrevive si navega rápido
      headers: { 'content-type': 'application/json' },
    }).catch(() => {})
  } catch {}
}
