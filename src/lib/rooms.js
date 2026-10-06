// Cliente de las salas (cine digital). Ver api/_lib/roomsApi.js.
// Fase 1: las novedades llegan por consultas frecuentes ("poll") que además sirven de latido de presencia.
// La velocidad se adapta (rápida si hay charla, lenta si está quieto o la pestaña está en segundo plano) para cuidar el plan gratis.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ROOM_ERRORS } from './roomRules'
import { socialErrorMessage } from './socialRules'
import { pulseEvent } from './pulse'

const BASE = '/api/rooms'

const request = async (action, { method = 'GET', body, query } = {}) => {
  const qs = query ? `?${new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== null)).toString()}` : ''
  try {
    const res = await fetch(`${BASE}/${action}${qs}`, {
      method, credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    let data = {}
    try { data = await res.json() } catch { /* sin cuerpo */ }
    return { ok: res.ok, status: res.status, data, error: res.ok ? null : (data.error || 'server_error') }
  } catch {
    return { ok: false, status: 0, data: {}, error: 'network' }
  }
}

export const roomErrorText = (code) => (code === 'network' ? 'No pudimos conectarnos. Revisá tu internet.' : ROOM_ERRORS[code] || socialErrorMessage(code))

export const rooms = {
  info: (code) => request('room', { query: { code } }),
  mine: () => request('mine'),
  create: async (body) => {
    const r = await request('create', { method: 'POST', body })
    if (r.ok) pulseEvent('room_created')
    return r
  },
  join: async (code) => {
    const r = await request('join', { method: 'POST', body: { code } })
    if (r.ok) pulseEvent('room_joined')
    return r
  },
  leave: (code) => request('leave', { method: 'POST', body: { code } }),
  sync: (code, since) => request('sync', { method: 'POST', body: { code, since } }),
  say: (code, text) => request('say', { method: 'POST', body: { code, text } }),
  react: (code, emoji) => request('react', { method: 'POST', body: { code, emoji } }),
  update: (code, patch) => request('update', { method: 'POST', body: { code, ...patch } }),
  close: (code) => request('close', { method: 'POST', body: { code } }),
  kick: (code, handle) => request('kick', { method: 'POST', body: { code, handle } }),
}

/** Velocidad de consulta según la actividad (ms). Pura para poder probarla. */
export const pollDelay = ({ hidden, lastActivityAt, now = Date.now() }) => {
  if (hidden) return 15_000
  return now - lastActivityAt < 60_000 ? 2_500 : 5_000
}

const MAX_KEPT = 300
const FATAL = new Set(['kicked', 'room_closed', 'room_not_found', 'room_full'])

/** Junta mensajes nuevos con los que ya hay, sin repetir (por seq) y acotando la memoria. */
export const mergeMessages = (current, incoming) => {
  if (!incoming.length) return current
  const seen = new Set(current.map((m) => m.seq))
  const added = incoming.filter((m) => !seen.has(m.seq))
  if (!added.length) return current
  return [...current, ...added].sort((a, b) => a.seq - b.seq).slice(-MAX_KEPT)
}

/**
 * Entra a la sala y la mantiene al día. `enabled` = hay sesión con @usuario.
 * Devuelve { status: 'idle'|'joining'|'in'|'error', error, room, members, messages, offset, say, react, leave, fx }
 *  · offset = hora del servidor − hora de este equipo (para que la cuenta regresiva coincida entre todos)
 *  · fx = reacciones nuevas para animar { id, emoji, handle }
 */
export const useRoom = (code, enabled) => {
  const [state, setState] = useState({ status: 'idle', error: null, room: null, members: [], messages: [], offset: 0 })
  const [fx, setFx] = useState([])
  const seq = useRef(0)
  const lastActivity = useRef(0)
  const timer = useRef(null)
  const alive = useRef(true)
  const first = useRef(true)

  const apply = useCallback((data) => {
    seq.current = Math.max(seq.current, data.seq || 0)
    const fresh = data.messages || []
    if (fresh.length) lastActivity.current = Date.now()
    if (!first.current) {
      const reacts = fresh.filter((m) => m.kind === 'react' && !m.mine).slice(-5)
      if (reacts.length) setFx((f) => [...f, ...reacts.map((m) => ({ id: `${m.seq}`, emoji: m.text, handle: m.handle }))].slice(-12))
    }
    first.current = false
    setState((s) => ({
      status: 'in', error: null, room: data.room, members: data.members,
      messages: mergeMessages(s.messages, fresh.filter((m) => m.kind !== 'react')),
      offset: (data.room?.serverNow || Date.now()) - Date.now(),
    }))
  }, [])

  useEffect(() => {
    alive.current = true
    first.current = true
    seq.current = 0
    lastActivity.current = Date.now()
    if (!enabled || !code) { setState((s) => ({ ...s, status: 'idle' })); return undefined }

    const loop = async () => {
      if (!alive.current) return
      const r = await rooms.sync(code, seq.current)
      if (!alive.current) return
      if (r.ok) apply(r.data)
      else if (r.error === 'not_member') {
        const j = await rooms.join(code)
        if (!alive.current) return
        if (j.ok) apply(j.data); else return setState((s) => ({ ...s, status: 'error', error: j.error }))
      } else if (FATAL.has(r.error)) return setState((s) => ({ ...s, status: 'error', error: r.error }))
      // errores de red o del servidor: seguimos intentando con calma
      timer.current = setTimeout(loop, r.ok ? pollDelay({ hidden: document.hidden, lastActivityAt: lastActivity.current }) : 8000)
    }

    setState((s) => ({ ...s, status: 'joining', error: null }))
    rooms.join(code).then((j) => {
      if (!alive.current) return
      if (!j.ok) return setState((s) => ({ ...s, status: 'error', error: j.error }))
      apply(j.data)
      timer.current = setTimeout(loop, pollDelay({ hidden: false, lastActivityAt: lastActivity.current }))
    })
    const onVisible = () => { if (!document.hidden && alive.current) { clearTimeout(timer.current); timer.current = setTimeout(loop, 200) } }
    document.addEventListener('visibilitychange', onVisible)
    return () => { alive.current = false; clearTimeout(timer.current); document.removeEventListener('visibilitychange', onVisible) }
  }, [code, enabled, apply])

  const say = useCallback(async (text) => {
    const r = await rooms.say(code, text)
    if (r.ok) { lastActivity.current = Date.now(); setState((s) => ({ ...s, messages: mergeMessages(s.messages, [r.data.message]) })) }
    return r
  }, [code])

  const react = useCallback(async (emoji) => {
    setFx((f) => [...f, { id: `me-${Date.now()}-${Math.random()}`, emoji, handle: null }].slice(-12))
    return rooms.react(code, emoji)
  }, [code])

  const leave = useCallback(async () => { alive.current = false; clearTimeout(timer.current); return rooms.leave(code) }, [code])
  const consumeFx = useCallback((id) => setFx((f) => f.filter((x) => x.id !== id)), [])

  return { ...state, say, react, leave, fx, consumeFx }
}
