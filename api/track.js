// Vercel Edge Function - registra una visita
//
// Lee geo headers que Vercel inyecta automáticamente.
// Persiste en Upstash Redis vía REST API directo (sin @vercel/kv).
//
// Endpoint público (no auth) — cualquiera puede llamarlo (es tracking).
// Data persistida es ANÓNIMA: solo país/ciudad/coords, no IP cruda.

import { redis, isRedisConfigured } from './_lib/redis.js'

export const config = { runtime: 'edge' }

const anonHash = async (ua, lang, day) => {
  const text = `${ua}|${lang}|${day}`
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

export default async function handler(req) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Geo de Vercel (gratis, sin API externa)
  const country = req.headers.get('x-vercel-ip-country') || null
  const city    = req.headers.get('x-vercel-ip-city')    || null
  const region  = req.headers.get('x-vercel-ip-country-region') || null
  let   lat     = parseFloat(req.headers.get('x-vercel-ip-latitude'))  || null
  let   lng     = parseFloat(req.headers.get('x-vercel-ip-longitude')) || null
  let   source  = 'vercel-ip'

  // Opt-in: cliente puede mandar coords precisas (geolocation API)
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

  // Sin geo (dev local) → no registramos
  if (!country || !city || lat == null || lng == null) {
    return Response.json({ ok: true, tracked: false, reason: 'no-geo' })
  }

  // Redis no configurado → respuesta OK silente para no romper el cliente
  if (!isRedisConfigured()) {
    return Response.json({ ok: true, tracked: false, reason: 'redis-not-configured' })
  }

  const ua   = req.headers.get('user-agent')      || ''
  const lang = req.headers.get('accept-language') || ''
  const day  = new Date().toISOString().slice(0, 10)
  const visitorHash = await anonHash(ua, lang, day)

  const cityName = decodeURIComponent(city)
  const cityKey  = `city:${country}:${cityName.toLowerCase().replace(/\s+/g, '-')}`
  const uniqueKey = `stats:uniques:${day}`

  try {
    await redis.hincrby(cityKey, 'visits', 1)
    await redis.hset(cityKey, {
      name: cityName,
      country,
      region: region || '',
      lat,
      lng,
      lastSeen: Date.now(),
      source,
    })
    if (source === 'geolocation') {
      await redis.hincrby(cityKey, 'geolocConsents', 1)
    }
    await redis.sadd('cities:all', cityKey)
    await redis.incr(`stats:visits:${day}`)
    await redis.sadd(uniqueKey, visitorHash)
    await redis.expire(uniqueKey, 7 * 24 * 3600)

    return Response.json({ ok: true, tracked: true, city: cityName, country, source })
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
