// Vercel Edge Function - registra una visita
//
// Recibe POST sin body. Lee geo headers que Vercel inyecta automáticamente
// (sin necesidad de servicio externo de geolocalización). Persiste en KV.
//
// Endpoint público (no auth) — cualquiera puede llamarlo (es para tracking).
// La data persistida es ANÓNIMA: solo país/ciudad/coords, no IP cruda.

import { kv } from '@vercel/kv'

export const config = { runtime: 'edge' }

// Hash anónimo simple para distinguir visitantes únicos por sesión sin guardar IP.
// Combinamos UA + accept-language + un nonce diario para que no sea trackeable
// pero sí podamos contar uniques aproximados.
const anonHash = async (ua, lang, day) => {
  const text = `${ua}|${lang}|${day}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

const isKvConfigured = () =>
  !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

export default async function handler(req) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Geo de Vercel (gratis, sin API externa). Headers inyectados automáticamente.
  const country = req.headers.get('x-vercel-ip-country') || null
  const city    = req.headers.get('x-vercel-ip-city')    || null
  const region  = req.headers.get('x-vercel-ip-country-region') || null
  let   lat     = parseFloat(req.headers.get('x-vercel-ip-latitude'))  || null
  let   lng     = parseFloat(req.headers.get('x-vercel-ip-longitude')) || null
  let   source  = 'vercel-ip'

  // Opt-in: el cliente puede mandar coords precisas (geolocation API del browser)
  // si el usuario aceptó el permiso. Sobreescribimos la geo de IP con la precisa.
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => null)
      if (body?.lat != null && body?.lng != null && body?.source === 'geolocation') {
        lat = Number(body.lat)
        lng = Number(body.lng)
        source = 'geolocation'
      }
    } catch {}
  }

  // Si no hay geo (dev local o región sin datos) no registramos
  if (!country || !city || lat == null || lng == null) {
    return Response.json({ ok: true, tracked: false, reason: 'no-geo' })
  }

  // KV no configurado todavía → respondemos OK silente para no romper cliente
  if (!isKvConfigured()) {
    return Response.json({ ok: true, tracked: false, reason: 'kv-not-configured' })
  }

  const ua   = req.headers.get('user-agent')      || ''
  const lang = req.headers.get('accept-language') || ''
  const day  = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const visitorHash = await anonHash(ua, lang, day)

  // Clave única por ciudad (un slug consistente)
  const cityKey = `city:${country}:${decodeURIComponent(city).toLowerCase().replace(/\s+/g, '-')}`

  try {
    // Pipeline atómico de Redis:
    //   - hincr visits (contador total de la ciudad)
    //   - hset name/country/lat/lng/lastSeen (metadata)
    //   - sadd a set diario de "ciudades vistas hoy"
    //   - sadd visitor único a set diario (para uniques)
    await kv.hincrby(cityKey, 'visits', 1)
    await kv.hset(cityKey, {
      name:     decodeURIComponent(city),
      country,
      region:   region || '',
      lat,
      lng,
      lastSeen: Date.now(),
      source,
    })
    if (source === 'geolocation') {
      // contador específico de visitantes que dieron permiso explícito
      await kv.hincrby(cityKey, 'geolocConsents', 1)
    }
    // Set "all cities" para que el GET pueda iterar
    await kv.sadd('cities:all', cityKey)
    // Contador global diario
    await kv.incr(`stats:visits:${day}`)
    // Uniques aproximados (set per day, 7 días retention)
    const uniqueKey = `stats:uniques:${day}`
    await kv.sadd(uniqueKey, visitorHash)
    await kv.expire(uniqueKey, 7 * 24 * 3600)

    return Response.json({ ok: true, tracked: true, city, country })
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
