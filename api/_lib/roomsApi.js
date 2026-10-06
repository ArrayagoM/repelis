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
  ROOM, EMOJIS, normalizeCode, randomCode, CODE_RE, validateRoomInput, validateMessage, roomPhase,
} from '../../src/lib/roomRules.js'
import { normalizeHandle } from '../../src/lib/socialRules.js'

const HOUR = 3_600_000
const NEW_ACCOUNT_WAIT_MS = HOUR
const CAPACITY_WINDOW_MS = 90_000          // quienes siguen "dentro" aunque se hayan demorado en el latido
const FIRST_LOAD = 50

const STATUS = {
  not_authenticated: 401, profile_required: 400, cannot_publish_yet: 403, forbidden: 403, kicked: 403, not_host: 403, not_member: 403,
  room_not_found: 404, room_closed: 410, room_full: 409, room_limit: 403, too_fast: 429, too_many_requests: 429,
}

/** @param {{ store, social, rooms, now?: () => number, rootEmails?: string[], rand?: () => number }} deps */
export const createRoomsApi = ({ store, social, rooms, voice = null, now = Date.now, rootEmails = [], rand = Math.random }) => {
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
      online: online.length, maxMembers: ROOM.maxMembers, serverNow: t, voice: { available: !!voice },
      isHost: isHostOf(room, viewer), isOwner: !!viewer && room.ownerId === viewer.id,
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
      members: online.map((m) => ({ handle: m.handle, name: m.name, host: m.userId === room.ownerId, me: m.userId === viewer.id })),
      messages: msgs.map((m) => ({ seq: m.seq, kind: m.kind, handle: m.handle, name: m.name, text: m.text, at: m.at, mine: !!m.userId && m.userId === viewer.id })),
    }
  }

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
      // El servidor de voz duerme cuando no hay nadie: lo despertamos ahora para que esté listo cuando entren (sin esperar la respuesta)
      if (voice && (!startsAt || startsAt - t < 15 * 60_000)) await voice.warm()
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

    // Token para abrir la voz de esta sala (solo quienes están dentro y no fueron sacados). Despierta el servidor si dormía.
    'POST voice-token': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (!voice) return fail('voice_unavailable', 503)
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      const phase = roomPhase(room, now())
      if (phase === 'closed' || phase === 'expired') return fail('room_closed')
      const m = await memberOf(room, viewer)
      if (!m) return fail((room.kicked || []).includes(viewer.id) ? 'kicked' : 'not_member')
      if (await limited(`room:voice:${viewer.id}`, 30, HOUR)) return fail('too_many_requests')
      await voice.warm()
      return ok({ url: voice.url, token: voice.token({ userId: viewer.id, handle: m.handle, name: m.name, code: room.code }, now()) })
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
      await rooms.upsertMember(room.code, { userId: viewer.id, handle: m.handle, name: m.name, lastSeen: now() })
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

    'POST close': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const room = await loadRoom(body.code)
      if (!room) return fail('room_not_found')
      if (!isHostOf(room, viewer)) return fail('not_host')
      if (!room.closedAt) { await rooms.updateRoom(room.code, { closedAt: now() }); await system(room.code, 'La sala se cerró. ¡Gracias por venir!') }
      if (voice) await voice.kick({ code: room.code, all: true })
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
      if (voice) await voice.kick({ code: room.code, userId: target.userId })
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
