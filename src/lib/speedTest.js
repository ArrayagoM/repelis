// ─────────────────────────────────────────────────────────────────────────
// Speed test de servidores de streaming
//
// Limitación honesta: CORS nos impide medir TTFB del HTML interno del player.
// Lo que SÍ podemos hacer y es muy buena proxy de "qué tan rápido reproduce":
//   1. fetch(URL, { mode: 'no-cors' }) con AbortController + timeout.
//   2. Cuando el fetch resuelve (aunque sea opaque) el handshake DNS+TCP+TLS
//      ya pasó y el server respondió HTTP headers — eso es lo que importa
//      para que el iframe arranque rápido.
//   3. Medimos `performance.now()` antes/después.
//
// Cacheamos resultados 6h (más fresco que 24h porque la red cambia mucho).
// ─────────────────────────────────────────────────────────────────────────

import { SOURCES } from './playerSources'

const CACHE_KEY = 'repelis:speed:v1'
const TTL_MS = 6 * 60 * 60 * 1000   // 6 horas
const TIMEOUT_MS = 4000              // si tarda más, lo descartamos
const PARALLELISM = 4                // pegarle a 4 a la vez, no a los 12

const safeGet = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed.ts || Date.now() - parsed.ts > TTL_MS) return null
    return parsed
  } catch { return null }
}

const safeSet = (data) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), ...data })) } catch {}
}

const probe = async (source) => {
  // Probamos contra un TMDB ID estable conocido (Inception, ID 27205) para que
  // el resultado sea reproducible entre runs sin depender del catálogo del usuario.
  const probeUrl = source.movieUrl(27205)
  const start = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)

  try {
    await fetch(probeUrl, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal,
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
    })
    clearTimeout(timer)
    return { id: source.id, ms: Math.round(performance.now() - start), ok: true }
  } catch {
    clearTimeout(timer)
    return { id: source.id, ms: TIMEOUT_MS, ok: false }
  }
}

// Pool con concurrencia limitada
const runWithLimit = async (items, fn, limit) => {
  const results = []
  let i = 0
  const workers = Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return results
}

/**
 * Devuelve { ranking: [{id, ms, ok}], ts } cacheado o midiendo en vivo.
 * `force = true` salta el cache.
 */
export const measureSources = async (force = false) => {
  if (!force) {
    const cached = safeGet()
    if (cached) return cached
  }

  const results = await runWithLimit(SOURCES, probe, PARALLELISM)
  // Ordena: ok=true primero, dentro de cada grupo por ms ascendente.
  results.sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1
    return a.ms - b.ms
  })

  const payload = { ranking: results }
  safeSet(payload)
  return payload
}

export const getCachedRanking = () => {
  const cached = safeGet()
  return cached?.ranking || null
}

/**
 * Devuelve los SOURCES reordenados según la última medición.
 * Si no hay cache aún, devuelve el orden estático.
 * Si hay un `lastSuccessId` (servidor que funcionó la última vez), va al frente.
 */
export const getSpeedRankedSources = (lastSuccessId = null) => {
  const ranking = getCachedRanking()
  if (!ranking) return SOURCES

  const sourceById = new Map(SOURCES.map((s) => [s.id, s]))
  const ordered = ranking.map((r) => sourceById.get(r.id)).filter(Boolean)

  // Cualquier source que no estuvo en la medición → al final
  const measuredIds = new Set(ranking.map((r) => r.id))
  for (const s of SOURCES) if (!measuredIds.has(s.id)) ordered.push(s)

  // El último que funcionó al frente (preserva la "memoria" del usuario)
  if (lastSuccessId) {
    const idx = ordered.findIndex((s) => s.id === lastSuccessId)
    if (idx > 0) ordered.unshift(...ordered.splice(idx, 1))
  }

  return ordered
}
