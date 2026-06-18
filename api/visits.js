// Vercel Edge Function - devuelve visitas agregadas para el admin
// GET requiere header `x-admin-pin` con env ADMIN_PIN.

import { redis, isRedisConfigured } from './_lib/redis.js'

export const config = { runtime: 'edge' }

const adminPin = () => process.env.ADMIN_PIN || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin',
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'GET')     return new Response('Method not allowed', { status: 405, headers: CORS })

  const configuredPin = adminPin()
  if (configuredPin) {
    const givenPin = req.headers.get('x-admin-pin') || new URL(req.url).searchParams.get('pin')
    if (givenPin !== configuredPin) {
      return Response.json({ error: 'unauthorized' }, { status: 401, headers: CORS })
    }
  }

  if (!isRedisConfigured()) {
    return Response.json({
      ok: false,
      kvConfigured: false,
      cities: [],
      stats: { today: 0, last7Days: 0, uniquesToday: 0, totalCities: 0, totalVisits: 0 },
      hint: 'Falta configurar Redis (Vercel KV o Upstash). Ver api/README.md',
    }, { headers: CORS })
  }

  try {
    const cityKeys = await redis.smembers('cities:all')
    const cities = []
    for (const key of cityKeys) {
      const data = await redis.hgetall(key)
      if (!data || !data.lat || !data.lng) continue
      cities.push({
        name: data.name,
        country: data.country,
        region: data.region || null,
        lat: Number(data.lat),
        lng: Number(data.lng),
        visits: Number(data.visits) || 0,
        geolocConsents: Number(data.geolocConsents) || 0,
        lastSeen: Number(data.lastSeen) || 0,
        source: data.source || 'vercel-ip',
      })
    }
    cities.sort((a, b) => b.visits - a.visits)

    const today = new Date().toISOString().slice(0, 10)
    const visitsToday  = Number(await redis.get(`stats:visits:${today}`)) || 0
    const uniquesToday = await redis.scard(`stats:uniques:${today}`)

    let last7Days = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      last7Days += Number(await redis.get(`stats:visits:${d}`)) || 0
    }

    return Response.json({
      ok: true,
      kvConfigured: true,
      cities,
      stats: {
        today: visitsToday,
        last7Days,
        uniquesToday,
        totalCities: cities.length,
        totalVisits: cities.reduce((a, c) => a + c.visits, 0),
      },
      generatedAt: Date.now(),
    }, { headers: CORS })
  } catch (err) {
    return Response.json({
      ok: false,
      error: String(err?.message || err),
      cities: [],
      stats: { today: 0, last7Days: 0, uniquesToday: 0, totalCities: 0, totalVisits: 0 },
    }, { status: 500, headers: CORS })
  }
}
