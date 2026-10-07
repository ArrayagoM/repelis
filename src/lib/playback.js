// Sincronización de la película en las salas.
//
// Los reproductores son de terceros (iframes): NO se pueden controlar desde afuera. Lo que sí hacemos:
//  1. Leer el minuto en que va cada persona cuando su reproductor lo informa (mensajes `PLAYER_EVENT`, p. ej. VidLink).
//  2. Compararlo con el del anfitrión y avisar cuánto se adelantó/atrasó, con instrucciones claras para corregirlo.
//  3. Una cuenta regresiva común ("3, 2, 1… ¡play!") que sirve con cualquier reproductor.
import { useSyncExternalStore } from 'react'

const EMPTY = { supported: false, t: 0, duration: 0, playing: false, at: 0 }
let state = EMPTY
let version = 0
const listeners = new Set()
const emit = () => { version += 1; listeners.forEach((fn) => fn()) }

const PLAY = new Set(['play', 'playing', 'started'])
const STOP = new Set(['pause', 'paused', 'ended', 'waiting'])
const TICK = new Set(['timeupdate', 'seeked', 'seeking', 'progress'])

/** Interpreta un mensaje de un reproductor. Devuelve { event, t, duration } o null si no es de reproducción. */
export const parsePlayerMessage = (raw) => {
  let d = raw
  if (typeof d === 'string') { try { d = JSON.parse(d) } catch { return null } }
  if (!d || typeof d !== 'object') return null
  const body = d.type === 'PLAYER_EVENT' && d.data && typeof d.data === 'object' ? d.data : d
  const event = String(body.event || body.type || '')
  if (!PLAY.has(event) && !STOP.has(event) && !TICK.has(event)) return null
  const t = Number(body.currentTime ?? body.time)
  if (!Number.isFinite(t) || t < 0 || t > 172_800) return null
  const duration = Number(body.duration)
  return { event, t, duration: Number.isFinite(duration) && duration > 0 ? duration : 0 }
}

/** Lo llama el reproductor de la app con cada mensaje que recibe del iframe. */
export const reportPlayerEvent = (raw, now = Date.now()) => {
  const m = parsePlayerMessage(raw)
  if (!m) return false
  let playing = state.playing
  if (PLAY.has(m.event)) playing = true
  else if (STOP.has(m.event)) playing = false
  else if (m.event === 'timeupdate') playing = true                       // si avanza el tiempo, está reproduciendo
  state = { supported: true, t: m.t, duration: m.duration || state.duration, playing, at: now }
  emit()
  return true
}

export const clearPlayback = () => { if (state.supported) { state = EMPTY; emit() } }
export const getPlayback = () => state
export const usePlayback = () => {
  useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn) }, () => version, () => 0)
  return state
}

const STALE_MS = 6000

/** Minuto actual estimado de esta persona (avanza entre mensajes si está reproduciendo). null si no hay datos recientes. */
export const currentPosition = (pb, now = Date.now()) => {
  if (!pb?.supported) return null
  const age = now - pb.at
  if (pb.playing && age > STALE_MS) return null                            // dejó de informar: no inventamos
  return pb.playing ? pb.t + Math.min(age, STALE_MS) / 1000 : pb.t
}

/** Posición para mandar a la sala en cada consulta: { t, playing } | null. */
export const positionForSync = (pb, now = Date.now()) => {
  const t = currentPosition(pb, now)
  return t === null ? null : { t: Math.round(t * 10) / 10, playing: !!pb.playing }
}

/** Dónde debería ir esta persona según el anfitrión (con `serverNow` = hora del servidor estimada). */
export const referenceTime = (hostPos, serverNow) => {
  if (!hostPos) return null
  return hostPos.playing ? hostPos.t + Math.max(0, serverNow - hostPos.at) / 1000 : hostPos.t
}

export const TOLERANCE_S = 2

/**
 * Consejo para acercarse al anfitrión.
 * @returns {{ kind: 'ok' } | { kind: 'ahead', seconds: number } | { kind: 'behind', seconds: number, target: number }}
 */
export const advise = (mineT, refT) => {
  if (mineT === null || refT === null || mineT === undefined || refT === undefined) return null
  const drift = mineT - refT
  if (Math.abs(drift) <= TOLERANCE_S) return { kind: 'ok' }
  return drift > 0 ? { kind: 'ahead', seconds: Math.round(drift) } : { kind: 'behind', seconds: Math.round(-drift), target: refT }
}

/** 75 → "1:15", 4325 → "1:12:05" */
export const formatClock = (sec) => {
  const s = Math.max(0, Math.floor(sec))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const mm = String(m).padStart(2, '0'), ss = String(r).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

/** Segundos que faltan (entero hacia arriba) para `at` según la hora del servidor estimada; ≤ 0 = ya pasó. */
export const countdownSeconds = (at, serverNow) => Math.ceil((at - serverNow) / 1000)
