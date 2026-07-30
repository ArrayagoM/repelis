// Vercel Edge Function - registra visitas y page views.
//
// Modelo:
//   - Cada NAVEGACIÓN (route change) manda un pageview → cuenta páginas vistas.
//   - La PRIMERA de la sesión además registra los atributos del visitante
//     (país, ciudad, dispositivo, SO, browser, referrer) → cuenta visitantes.
//
// Todo anónimo y agregado. No se guarda IP cruda.

import { redis, isRedisConfigured } from './_lib/redis.js'
import { parseUA, referrerHost } from './_lib/ua.js'

export const config = { runtime: 'edge' }

const anonHash = async (ua, lang, day) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ua}|${lang}|${day}`))
  return Array.from(new Uint8Array(buf)).slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Normaliza un path para no explotar el cardinal de claves:
// /movie/12345 → /movie/:id, /tv/999 → /tv/:id, etc.
const normalizePath = (p = '/') => {
  if (!p) return '/'
  return p
    .replace(/\/movie\/\d+.*/, '/movie/:id')
    .replace(/\/tv\/\d+.*/, '/tv/:id')
    .replace(/\?.*$/, '')
    .slice(0, 60) || '/'
}

const RETENTION = 60 * 24 * 3600  // 60 días para las claves diarias

export default async function handler(req) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  const country = req.headers.get('x-vercel-ip-country') || null
  const city    = req.headers.get('x-vercel-ip-city')    || null
  const region  = req.headers.get('x-vercel-ip-country-region') || null
  let   lat     = parseFloat(req.headers.get('x-vercel-ip-latitude'))  || null
  let   lng     = parseFloat(req.headers.get('x-vercel-ip-longitude')) || null

  let path = '/'
  let referrer = ''
  let isVisit = true
  let coordsSource = 'vercel-ip'

  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => null)
      if (body) {
        if (body.path) path = body.path
        if (body.referrer) referrer = body.referrer
        if (typeof body.isVisit === 'boolean') isVisit = body.isVisit
        if (body.lat != null && body.lng != null && body.source === 'geolocation') {
          lat = Number(body.lat); lng = Number(body.lng); coordsSource = 'geolocation'
        }
      }
    } catch {}
  }

  if (!isRedisConfigured()) {
    return Response.json({ ok: true, tracked: false, reason: 'redis-not-configured' })
  }

  const day  = new Date().toISOString().slice(0, 10)
  const np   = normalizePath(path)

  try {
    // ── Page view: SIEMPRE ──
    await redis.incr(`stats:pageviews:${day}`)
    await redis.expire(`stats:pageviews:${day}`, RETENTION)
    await redis.hincrby('agg:pages', np, 1)

    // ── Visita (primera de la sesión): atributos del visitante ──
    if (isVisit) {
      const ua   = req.headers.get('user-agent')      || ''
      const lang = req.headers.get('accept-language') || ''
      const { device, os, browser } = parseUA(ua)
      const selfHost = req.headers.get('host') || ''
      const refHost  = referrerHost(referrer, selfHost)
      const visitorHash = await anonHash(ua, lang, day)

      await redis.incr(`stats:visits:${day}`)
      await redis.expire(`stats:visits:${day}`, RETENTION)
      await redis.sadd(`stats:uniques:${day}`, visitorHash)
      await redis.expire(`stats:uniques:${day}`, RETENTION)

      await redis.hincrby('agg:devices', device, 1)
      await redis.hincrby('agg:os', os, 1)
      await redis.hincrby('agg:browsers', browser, 1)
      if (country) await redis.hincrby('agg:countries', country, 1)
      await redis.hincrby('agg:referrers', refHost || 'Directo', 1)

      // Ciudad (para el mapa) — solo si Vercel dio geo
      if (country && city && lat != null && lng != null) {
        const cityName = decodeURIComponent(city)
        const cityKey  = `city:${country}:${cityName.toLowerCase().replace(/\s+/g, '-')}`
        await redis.hincrby(cityKey, 'visits', 1)
        await redis.hset(cityKey, {
          name: cityName, country, region: region || '', lat, lng,
          lastSeen: Date.now(), source: coordsSource,
        })
        await redis.sadd('cities:all', cityKey)
      }
    }

    return Response.json({ ok: true, tracked: true, isVisit, path: np, country })
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 500 })
  }
}
