// ─────────────────────────────────────────────────────────────────────────
// Health check de los 17 servidores de streaming.
// Devuelve estado, latencia y % de éxito histórico (rolling 50 muestras).
// ─────────────────────────────────────────────────────────────────────────

import { SOURCES } from './playerSources'

const HISTORY_KEY = 'repelis:srvHealth:v1'
const ROLLING_WINDOW = 50
const TIMEOUT_MS = 5000

const safeGet = () => {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '{}') } catch { return {} }
}
const safeSet = (data) => {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(data)) } catch {}
}

const recordSample = (id, ok, ms) => {
  const all = safeGet()
  const arr = all[id] || []
  arr.push({ ts: Date.now(), ok, ms })
  if (arr.length > ROLLING_WINDOW) arr.splice(0, arr.length - ROLLING_WINDOW)
  all[id] = arr
  safeSet(all)
}

const ping = async (source) => {
  // Probamos con un TMDB ID estable conocido
  const url = source.movieUrl(27205)
  const start = performance.now()
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    await fetch(url, { method: 'GET', mode: 'no-cors', cache: 'no-store', signal: ctrl.signal, referrerPolicy: 'no-referrer' })
    clearTimeout(timer)
    const ms = Math.round(performance.now() - start)
    recordSample(source.id, true, ms)
    return { id: source.id, label: source.label, ok: true, ms, esLat: !!source.esLat }
  } catch {
    clearTimeout(timer)
    recordSample(source.id, false, TIMEOUT_MS)
    return { id: source.id, label: source.label, ok: false, ms: TIMEOUT_MS, esLat: !!source.esLat }
  }
}

export const pingAll = async () => {
  // Concurrencia 4 para no saturar
  const out = []
  const queue = [...SOURCES]
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const s = queue.shift()
      out.push(await ping(s))
    }
  })
  await Promise.all(workers)
  return out
}

export const pingOne = (sourceId) => {
  const s = SOURCES.find((x) => x.id === sourceId)
  if (!s) return Promise.resolve(null)
  return ping(s)
}

export const getServerHistory = () => {
  const all = safeGet()
  const stats = {}
  for (const s of SOURCES) {
    const samples = all[s.id] || []
    const total = samples.length
    const ok = samples.filter((x) => x.ok).length
    const avgMs = total ? Math.round(samples.reduce((a, x) => a + (x.ok ? x.ms : 0), 0) / Math.max(1, ok)) : 0
    stats[s.id] = {
      label: s.label,
      esLat: !!s.esLat,
      samples: total,
      okPct: total ? Math.round((ok / total) * 100) : 0,
      avgMs,
      lastSample: samples[samples.length - 1] || null,
    }
  }
  return stats
}

export const clearServerHistory = () => {
  try { localStorage.removeItem(HISTORY_KEY) } catch {}
}
