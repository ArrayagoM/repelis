// Vercel Edge Function: devuelve el país aproximado de quien pregunta (lo informa la propia red de Vercel).
// Se usa solo para elegir el idioma de la interfaz cuando el navegador no dice cuál. No guarda nada.
export const config = { runtime: 'edge' }

export default function handler(req) {
  const country = String(req.headers.get('x-vercel-ip-country') || '').toUpperCase().slice(0, 2)
  return new Response(JSON.stringify({ country: /^[A-Z]{2}$/.test(country) ? country : '' }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}
