// ─────────────────────────────────────────────────────────────────────────
// API de SALAS (cine digital): crear una sala, entrar con un enlace, chatear, reaccionar y esperar juntos la hora de arranque.
//
//  · Ver los datos básicos de una sala es libre (para que el enlace compartido muestre de qué se trata);
//    entrar, chatear y crear requiere cuenta con @usuario.
//  · El servidor vuelve a validar TODO (src/lib/roomRules.js). Sin links en el chat, límites de velocidad y de personas.
//  · Fase 1: las novedades llegan por consultas frecuentes (poll). El transporte es intercambiable (ver `sync`).
//  · Privacidad: no se graba nada; los mensajes se borran 24 h después de que termina la sala.
// ─────────────────────────────────────────────────────────────────────────
import { authenticateSession, isRoot, checkWriteRequest } from './session.js'
import {
  ROOM, EMOJIS, SYNC, normalizePos, normalizeCode, randomCode, CODE_RE, validateRoomInput, validateMessage, roomPhase,
} from '../../src/lib/roomRules.js'
import { normalizeHandle } from '../../src/lib/socialRules.js'

const HOUR = 3_600_000
const NEW_ACCOUNT_WAIT_MS = HOUR
const CAPACITY_WINDOW_MS = 90_000          // quienes siguen "dentro" aunque se hayan demorado en el latido
const FIRST_LOAD = 50

export const DEFAULT_ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
const SIGNAL_MAX_CHARS = 8000

const STATUS = {
  not_authenticated: 401, profile_required: 400, cannot_publish_yet: 403, forbidden: 403, kicked: 403, not_host: 403, not_member: 403,
  room_not_found: 404, room_closed: 410, room_full: 409, room_limit: 403, too_fast: 429, too_many_requests: 429,
}

/** @param {{ store, social, rooms, now?: () => number, rootEmails?: string[], rand?: () => number }} deps */
export const createRoomsApi = ({ store, social, rooms, ice = DEFAULT_ICE, voiceEnabled = true, now = Date.now, rootEmails = [], rand = Math.random }) => {
  const reply = (status, body) => ({ status, body })
  const ok = (body = { ok: true }) => reply(200, body)
  const fail = (code, status) => reply(status || STATUS[code] || 400, { error: code })

  const limited = async (key, max, windowMs) => (await store.hit(key, windowMs, now())) > max
  const canPublish = (user) => user.emailVerified === true || now() - (user.createdAt || 0) >= NEW_ACCOUNT_WAIT_MS

  const loadRoom = async (rawCode) => {
    const code = normalizeCode(rawCode)
    if (!CODE_RE.test(code)) return null
    return rooms.getRoom(code)
  }
  const isHostOf = (room, viewer) => !!viewer && (room.ownerId === viewer.id || isRoot(viewer, rootEmails))
  const system = async (code, text) => {
    const seq = await rooms.nextSeq(code)
    if (seq) await rooms.addMessage({ code, seq, kind: 'sys', userId: null, handle: null, name: null, text, at: now() })
  }

  const publicRoom = async (room, viewer) => {
    const t = now()
    const [host, online] = await Promise.all([social.getProfile(room.ownerId), rooms.onlineMembers(room.code, t - ROOM.onlineMs)])
    return {
      code: room.code, title: room.title, item: room.item, startsAt: room.startsAt, createdAt: room.createdAt,
      phase: roomPhase(room, t), host: host ? { handle: host.handle, name: host.name } : null,
      online: online.length, maxMembers: ROOM.maxMembers, serverNow: t, voice: { available: !!voiceEnabled },
      isHost: isHostOf(room, viewer), isOwner: !!viewer && room.ownerId === viewer.id,
      sync: room.sync || null,
    }
  }

  /** Estado completo para quien está dentro: sala, personas conectadas y mensajes nuevos. */
  const stateFor = async (room, viewer, since) => {
    const t = now()
    const from = since > 0 ? since : Math.max(0, room.seq - FIRST_LOAD)
    const [info, online, msgs] = await Promise.all([
      publicRoom(room, viewer), rooms.onlineMembers(room.code, t - ROOM.onlineMs), rooms.messagesSince(room.code, from, 100),
    ])
    return {
      room: info, seq: room.seq,
      members: online.map((m) => ({ handle: m.handle, name: m.name, host: m.userId === room.ownerId, me: m.userId === viewer.id, voice: voiceOf(m), pos: posOf(m, t) })),
      messages: msgs.map((m) => ({ seq: m.seq, kind: m.kind, handle: m.handle, name: m.name, text: m.text, at: m.at, mine: !!m.userId && m.userId === viewer.id })),
    }
  }

  /** Posición de reproducción informada por su reproductor (solo si es reciente). */
  const posOf = (m, t) => (m.pos && t - m.pos.at <= SYNC.posFreshMs ? { t: m.pos.t, playing: !!m.pos.playing, at: m.pos.at } : null)
  const voiceOf = (m) => ({ on: !!m.voice?.on, muted: !!m.voice?.muted })

  /** Quien habla/entra necesita cuenta, @usuario y poder publicar. Devuelve { profile } o { error }. */
  const speaker = async (viewer) => {
    if (!viewer) return { error: 'not_authenticated' }
    if (!canPublish(viewer)) return { error: 'cannot_publish_yet' }
    const profile = await social.getProfile(viewer.id)
    return profile ? { profile } : { error: 'profile_required' }
  }

  const memberOf = async (room, viewer) => {
    const m = await rooms.getMember(room.code, viewer.id)
    return !!m && !(room.kicked || []).includes(viewer.id) ? m : null
  }

  const actions = {
    // Datos públicos de la sala (para el enlace compartido)
    'GET room': async ({ query, viewer }) => {
      const room = await loadRoom(query.code)
      if (!room) return fail('room_not_found')
      return ok({ room: await publicRoom(room, viewer) })
    },

    'GET mine': async ({ viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const list = await rooms.roomsForUser(viewer.id, now())
      return ok({ rooms: await Promise.all(list.map((r) => publicRoom(r, viewer))) })
    },

    'POST create': async ({ body, viewer }) => {
      const who = await speaker(viewer)
      if (who.error) return fail(who.error)
      if (await limited(`room:create:${viewer.id}`, 5, HOUR)) return fail('too_many_requests')
      const checked = validateRoomInput(body, now())
      if (checked.error) return fail(checked.error, 400)
      if ((await rooms.countActiveByOwner(viewer.id, now())) >= ROOM.maxActivePerOwner) return fail('room_limit')

      const t = now()
      const { title, startsAt, item } = checked.value
      let room = null
      for (let i = 0; i < 6 && !room; i++) {
        try {
          room = await rooms.createRoom({ code: randomCode(rand), ownerId: viewer.id, title, item, startsAt, createdAt: t, expiresAt: (startsAt || t) + ROOM.lifeMs })
        } catch (e) { if (e?.code !== 'code_taken') throw e }
      }
      if (!room) return fail('server_error', 500)
      await rooms.upsertMember(room.code, { userId: viewer.id, handle: who.profile.handle, name: who.profile.name, lastSeen: t })
      await system(room.code, `@${who.profile.handle} abrió la sala`)
      await rooms.deleteExpired(t)                        // limpieza de salas viejas (barata y acotada)
      return ok({ room: await publicRoom((await rooms.getRoom(room.code)), viewer) })
    },

    'POST join': async ({ body, viewer }) => {
      const who = await speaker(viewer)
      if (who.error) return fail(who.error)
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      const phase = roomPhase(room, now())
      if (phase === 'closed' || phase === 'expired') return fail('room_closed')
      if ((room.kicked || []).includes(viewer.id)) return fail('kicked')
      if (await limited(`room:join:${viewer.id}`, 40, HOUR)) return fail('too_many_requests')

      const t = now()
      const already = await rooms.getMember(room.code, viewer.id)
      if (!already) {
        const present = await rooms.onlineMembers(room.code, t - CAPACITY_WINDOW_MS)
        if (present.length >= ROOM.maxMembers) return fail('room_full')
      }
      const isNew = await rooms.upsertMember(room.code, { userId: viewer.id, handle: who.profile.handle, name: who.profile.name, lastSeen: t })
      if (isNew) await system(room.code, `@${who.profile.handle} entró`)
      return ok(await stateFor(await rooms.getRoom(room.code), viewer, 0))
    },

    // ─── Voz (llamada WebRTC en malla): el audio va directo entre las personas; acá solo se pasan las "señales" para armar la conexión ───
    // Entrar/salir de la llamada y silenciar. Al entrar devuelve quiénes ya están en la llamada y los servidores ICE (STUN/TURN).
    'POST voice': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (!voiceEnabled) return fail('voice_unavailable', 503)
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      const phase = roomPhase(room, now())
      if (phase === 'closed' || phase === 'expired') return fail('room_closed')
      const m = await memberOf(room, viewer)
      if (!m) return fail((room.kicked || []).includes(viewer.id) ? 'kicked' : 'not_member')
      if (await limited(`room:voice:${viewer.id}`, 120, HOUR)) return fail('too_many_requests')
      const t = now()
      const patch = {}
      if (typeof body.on === 'boolean') { patch.on = body.on; if (body.on) { patch.since = t; patch.muted = false } else patch.muted = false }
      if (typeof body.muted === 'boolean' && body.on !== false) patch.muted = body.muted
      const saved = await rooms.setVoice(room.code, viewer.id, patch)
      const roster = (await rooms.onlineMembers(room.code, t - ROOM.onlineMs)).filter((p) => p.userId !== viewer.id && p.voice?.on)
        .map((p) => ({ handle: p.handle, name: p.name, muted: !!p.voice.muted, since: p.voice.since || 0 }))
      return ok({ on: !!saved?.voice?.on, muted: !!saved?.voice?.muted, since: saved?.voice?.since || 0, handle: m.handle, peers: roster, ice })
    },

    // Mandar una señal (oferta, respuesta o candidato ICE) a otra persona que esté en la llamada.
    'POST signal': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (!voiceEnabled) return fail('voice_unavailable', 503)
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      const me = await memberOf(room, viewer)
      if (!me) return fail('not_member')
      if (!me.voice?.on) return fail('not_in_voice', 403)
      const to = normalizeHandle(body.to)
      const target = (await rooms.onlineMembers(room.code, now() - ROOM.onlineMs)).find((p) => p.handle === to)
      if (!target || !target.voice?.on || target.userId === viewer.id) return fail('room_not_found')
      let data
      try { data = JSON.stringify(body.data ?? null) } catch { return fail('bad_request', 400) }
      if (data.length > SIGNAL_MAX_CHARS || body.data === null || typeof body.data !== 'object') return fail('bad_request', 400)
      if (await limited(`room:signal:${viewer.id}`, 150, 10_000)) return fail('too_fast')
      await rooms.pushSignal(room.code, { to, from: me.handle, data: JSON.parse(data), at: now() })
      return ok()
    },

    // Recoger mis señales pendientes. Es liviano y además sirve de latido: el cliente lo llama rápido mientras conecta y despacio después.
    'POST signals': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (!voiceEnabled) return fail('voice_unavailable', 503)
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      const phase = roomPhase(room, now())
      if (phase === 'closed' || phase === 'expired') return fail('room_closed')
      const me = await memberOf(room, viewer)
      if (!me) return fail((room.kicked || []).includes(viewer.id) ? 'kicked' : 'not_member')
      const t = now()
      await rooms.upsertMember(room.code, { userId: viewer.id, handle: me.handle, name: me.name, lastSeen: t })
      const [pending, online] = await Promise.all([rooms.takeSignals(room.code, me.handle, t), rooms.onlineMembers(room.code, t - ROOM.onlineMs)])
      return ok({
        signals: pending.map((s) => ({ from: s.from, data: s.data })),
        peers: online.filter((p) => p.userId !== viewer.id && p.voice?.on).map((p) => ({ handle: p.handle, name: p.name, muted: !!p.voice.muted, since: p.voice.since || 0 })),
        me: { on: !!me.voice?.on, muted: !!me.voice?.muted },
      })
    },

    'POST leave': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const room = await loadRoom(body.code)
      if (!room) return ok()
      const m = await rooms.getMember(room.code, viewer.id)
      if (m && (await rooms.removeMember(room.code, viewer.id))) await system(room.code, `@${m.handle} salió`)
      return ok()
    },

    // Latido + novedades: se llama cada pocos segundos. Mantiene "conectado" a quien consulta.
    'POST sync': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      if ((room.kicked || []).includes(viewer.id)) return fail('kicked')
      const m = await rooms.getMember(room.code, viewer.id)
      if (!m) return fail('not_member')
      const pos = normalizePos(body.pos)
      await rooms.upsertMember(room.code, { userId: viewer.id, handle: m.handle, name: m.name, lastSeen: now(), ...(pos === undefined ? {} : { pos: pos ? { ...pos, at: now() } : null }) })
      const since = Math.max(0, Math.trunc(Number(body.since)) || 0)
      return ok(await stateFor(room, viewer, since))
    },

    'POST say': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      const phase = roomPhase(room, now())
      if (phase === 'closed' || phase === 'expired') return fail('room_closed')
      const m = await memberOf(room, viewer)
      if (!m) return fail((room.kicked || []).includes(viewer.id) ? 'kicked' : 'not_member')
      const checked = validateMessage(body.text)
      if (checked.error) return fail(checked.error, 400)
      if (await limited(`room:say:${viewer.id}`, 8, 10_000)) return fail('too_fast')
      const seq = await rooms.nextSeq(room.code)
      const msg = { code: room.code, seq, kind: 'msg', userId: viewer.id, handle: m.handle, name: m.name, text: checked.value, at: now() }
      await rooms.addMessage(msg)
      return ok({ message: { seq, kind: 'msg', handle: m.handle, name: m.name, text: msg.text, at: msg.at, mine: true } })
    },

    'POST react': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      const phase = roomPhase(room, now())
      if (phase === 'closed' || phase === 'expired') return fail('room_closed')
      const m = await memberOf(room, viewer)
      if (!m) return fail('not_member')
      if (!EMOJIS.includes(body.emoji)) return fail('bad_emoji', 400)
      if (await limited(`room:react:${viewer.id}`, 15, 10_000)) return fail('too_fast')
      const seq = await rooms.nextSeq(room.code)
      await rooms.addMessage({ code: room.code, seq, kind: 'react', userId: viewer.id, handle: m.handle, name: m.name, text: body.emoji, at: now() })
      return ok({ seq })
    },

    // Anfitrión: cambiar nombre, horario o película
    'POST update': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      if (!isHostOf(room, viewer)) return fail('not_host')
      if (roomPhase(room, now()) === 'closed') return fail('room_closed')
      const checked = validateRoomInput({ title: body.title ?? room.title, startsAt: 'startsAt' in body ? body.startsAt : room.startsAt, item: 'item' in body ? body.item : room.item }, now())
      if (checked.error) return fail(checked.error, 400)
      const { title, startsAt, item } = checked.value
      const saved = await rooms.updateRoom(room.code, { title, startsAt, item, expiresAt: (startsAt || room.createdAt) + ROOM.lifeMs })
      if (startsAt !== room.startsAt) await system(room.code, startsAt ? 'El anfitrión cambió el horario de arranque' : 'El anfitrión quitó el horario: la sala está abierta')
      return ok({ room: await publicRoom(saved, viewer) })
    },

    // Anfitrión: cuenta regresiva común ("3, 2, 1… ¡play!"): todos la ven llegar a cero a la vez y dan play juntos.
    'POST countdown': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      if (!isHostOf(room, viewer)) return fail('not_host')
      const phase = roomPhase(room, now())
      if (phase === 'closed' || phase === 'expired') return fail('room_closed')
      if (await limited(`room:countdown:${room.code}`, 6, 60_000)) return fail('sync_fast', 429)
      const seconds = Math.min(SYNC.maxSeconds, Math.max(SYNC.minSeconds, Math.trunc(Number(body.seconds)) || SYNC.defaultSeconds))
      const sync = { id: (room.sync?.id || 0) + 1, at: now() + seconds * 1000, seconds }
      await rooms.updateRoom(room.code, { sync })
      await system(room.code, `Cuenta regresiva de ${seconds} segundos: ¡play juntos!`)
      return ok({ sync, serverNow: now() })
    },

    'POST close': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      if (!isHostOf(room, viewer)) return fail('not_host')
      if (!room.closedAt) { await rooms.updateRoom(room.code, { closedAt: now() }); await system(room.code, 'La sala se cerró. ¡Gracias por venir!') }

      return ok()
    },

    'POST kick': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      if (!isHostOf(room, viewer)) return fail('not_host')
      const handle = normalizeHandle(body.handle)
      const online = await rooms.onlineMembers(room.code, now() - CAPACITY_WINDOW_MS)
      const target = online.find((m) => m.handle === handle)
      if (!target) return fail('room_not_found')
      if (target.userId === room.ownerId) return fail('cannot_kick_self', 400)
      await rooms.addKicked(room.code, target.userId)
      await rooms.removeMember(room.code, target.userId)

      await system(room.code, `@${target.handle} fue sacado de la sala`)
      return ok()
    },
  }

  return async ({ method, action, headers = {}, body, query = {} }) => {
    const m = String(method || '').toUpperCase()
    const handler = actions[`${m} ${action}`]
    if (!handler) return fail('not_found', 404)

    const h = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
    if (m === 'POST') {
      const bad = checkWriteRequest(h)
      if (bad) return fail(bad.error, bad.status)
    }
    try {
      const auth = await authenticateSession({ store, headers: h, now: now() })
      return await handler({
        body: m === 'POST' && body && typeof body === 'object' && !Array.isArray(body) ? body : {},
        query, viewer: auth?.user || null,
      })
    } catch (e) {
      console.error('[rooms]', action, e?.message)
      return fail('server_error', 500)
    }
  }
}
