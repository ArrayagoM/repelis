// Vercel Edge Function - devuelve visitas agregadas para el admin
//
// GET requiere header `x-admin-pin` con el PIN configurado en env ADMIN_PIN.
// Devuelve: { cities: [...], stats: { today, last7Days, uniquesToday } }

import { kv } from '@vercel/kv'

export const config = { runtime: 'edge' }

const isKvConfigured = () =>
  !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

const adminPin = () => process.env.ADMIN_PIN || ''

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin',
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS })
  }

  // Auth: PIN requerido si está configurado.
  // Si NO está configurado en env, dejamos pasar (modo desarrollo).
  const configuredPin = adminPin()
  if (configuredPin) {
    const givenPin = req.headers.get('x-admin-pin') || new URL(req.url).searchParams.get('pin')
    if (givenPin !== configuredPin) {
      return Response.json({ error: 'unauthorized' }, { status: 401, headers: CORS_HEADERS })
    }
  }

  if (!isKvConfigured()) {
    return Response.json({
      ok: false,
      kvConfigured: false,
      cities: [],
      stats: { today: 0, last7Days: 0, uniquesToday: 0 },
      hint: 'Activá Vercel KV en tu proyecto y redeployá para empezar a ver datos.',
    }, { headers: CORS_HEADERS })
  }

  try {
    // 1) Lista de todas las ciudades vistas
    const cityKeys = await kv.smembers('cities:all')

    // 2) Pipeline batch para traer todas las hashes a la vez
    const cities = []
    for (const key of cityKeys) {
      const data = await kv.hgetall(key)
      if (!data || !data.lat || !data.lng) continue
      cities.push({
        name: data.name,
        country: data.country,
        region: data.region || null,
        lat: Number(data.lat),
        lng: Number(data.lng),
        visits: Number(data.visits) || 0,
        lastSeen: Number(data.lastSeen) || 0,
      })
    }
    cities.sort((a, b) => b.visits - a.visits)

    // 3) Stats agregadas
    const today = new Date().toISOString().slice(0, 10)
    const visitsToday  = Number(await kv.get(`stats:visits:${today}`)) || 0
    const uniquesToday = Number(await kv.scard(`stats:uniques:${today}`)) || 0

    let last7Days = 0
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10)
      last7Days += Number(await kv.get(`stats:visits:${d}`)) || 0
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
    }, { headers: CORS_HEADERS })
  } catch (err) {
    return Response.json({ ok: false, error: String(err?.message || err) }, { status: 500, headers: CORS_HEADERS })
  }
}
