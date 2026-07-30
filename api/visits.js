// Vercel Edge Function - devuelve analytics agregadas para el admin.
// GET requiere header x-admin-pin === ADMIN_PIN.

import { redis, isRedisConfigured } from './_lib/redis.js'

export const config = { runtime: 'edge' }

const adminPin = () => process.env.ADMIN_PIN || ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-pin',
}

const EMPTY = {
  visitorsToday: 0, pageviewsToday: 0, visitors7d: 0, pageviews7d: 0,
  uniquesToday: 0, totalCities: 0, totalVisits: 0,
}

// Convierte un HGETALL {k:v,...} a [{name,count}] ordenado desc.
const hashToRanked = (obj, keyName = 'name') => {
  if (!obj) return []
  return Object.entries(obj)
    .map(([k, v]) => ({ [keyName]: k, count: Number(v) || 0 }))
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count)
}

const dayStr = (offsetDays) =>
  new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10)

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
      ok: false, kvConfigured: false,
      cities: [], series: [], pages: [], referrers: [], countries: [],
      devices: [], os: [], browsers: [], stats: EMPTY,
    }, { headers: CORS })
  }

  try {
    // ── Serie de 7 días (visitantes + páginas vistas) ──
    const series = []
    let visitors7d = 0, pageviews7d = 0
    for (let i = 6; i >= 0; i--) {
      const d = dayStr(i)
      const visitors  = Number(await redis.get(`stats:visits:${d}`)) || 0
      const pageviews = Number(await redis.get(`stats:pageviews:${d}`)) || 0
      visitors7d += visitors; pageviews7d += pageviews
      series.push({ date: d, visitors, pageviews })
    }

    const today = dayStr(0)
    const uniquesToday = await redis.scard(`stats:uniques:${today}`)

    // ── Agregados (all-time) ──
    const [pagesH, refsH, countriesH, devicesH, osH, browsersH] = await Promise.all([
      redis.hgetall('agg:pages'),
      redis.hgetall('agg:referrers'),
      redis.hgetall('agg:countries'),
      redis.hgetall('agg:devices'),
      redis.hgetall('agg:os'),
      redis.hgetall('agg:browsers'),
    ])

    const pages     = hashToRanked(pagesH, 'path').slice(0, 12)
    const referrers = hashToRanked(refsH, 'host').slice(0, 10)
    const countries = hashToRanked(countriesH, 'code').slice(0, 12)
    const devices   = hashToRanked(devicesH, 'name')
    const os        = hashToRanked(osH, 'name')
    const browsers  = hashToRanked(browsersH, 'name')

    // ── Ciudades (mapa) ──
    const cityKeys = await redis.smembers('cities:all')
    const cities = []
    for (const key of cityKeys) {
      const data = await redis.hgetall(key)
      if (!data || !data.lat || !data.lng) continue
      cities.push({
        name: data.name, country: data.country,
        lat: Number(data.lat), lng: Number(data.lng),
        visits: Number(data.visits) || 0,
      })
    }
    cities.sort((a, b) => b.visits - a.visits)

    const series0 = series[series.length - 1] || { visitors: 0, pageviews: 0 }

    return Response.json({
      ok: true, kvConfigured: true,
      series, pages, referrers, countries, devices, os, browsers, cities,
      stats: {
        visitorsToday:  series0.visitors,
        pageviewsToday: series0.pageviews,
        visitors7d, pageviews7d,
        uniquesToday,
        totalCities: cities.length,
        totalVisits: cities.reduce((a, c) => a + c.visits, 0),
      },
      generatedAt: Date.now(),
    }, { headers: CORS })
  } catch (err) {
    return Response.json({
      ok: false, error: String(err?.message || err),
      cities: [], series: [], pages: [], referrers: [], countries: [],
      devices: [], os: [], browsers: [], stats: EMPTY,
    }, { status: 500, headers: CORS })
  }
}
