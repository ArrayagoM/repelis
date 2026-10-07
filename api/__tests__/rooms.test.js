import { describe, it, expect, beforeEach } from 'vitest'
import { createRoomsApi } from '../_lib/roomsApi.js'
import { createMemoryRooms } from '../_lib/roomsStore.js'
import { createMemoryStore } from '../_lib/stores.js'
import { createMemorySocial } from '../_lib/socialStore.js'
import { sha256 } from '../_lib/passwords.js'
import { ROOM, extractCode, validateRoomInput, validateMessage, roomPhase, formatCountdown, randomCode, CODE_RE } from '../../src/lib/roomRules.js'

const T0 = Date.UTC(2026, 9, 20, 22, 0, 0)
const ROOT = 'fundador@mail.com'
let store, social, rooms, clock, api, n

const H = { 'content-type': 'application/json', host: 'lifehigh.test' }
const mkUser = async (handle, over = {}) => {
  n += 1
  const user = await store.createUser({ email: `u${n}@mail.com`, name: `Usuario ${n}`, emailVerified: true, createdAt: T0 - 7 * 86400000, library: {}, ...over })
  const token = `tok-${user.id}`
  await store.createSession({ id: sha256(token), userId: user.id, ua: '', createdAt: clock, expiresAt: clock + 400 * 86400000 })
  if (handle) await social.createProfile({ userId: user.id, handle, name: user.name, bio: '', createdAt: clock, handleChangedAt: 0 })
  return { user, h: { ...H, cookie: `lh_session=${token}` } }
}
const get = (action, query = {}, h = { host: 'lifehigh.test' }) => api({ method: 'GET', action, headers: h, query })
const post = (action, body, h) => api({ method: 'POST', action, headers: h, body })
const open = async (u, over = {}) => (await post('create', { title: 'Noche de terror', ...over }, u.h)).body.room

beforeEach(() => {
  store = createMemoryStore(); social = createMemorySocial(); rooms = createMemoryRooms(); clock = T0; n = 0
  api = createRoomsApi({ store, social, rooms, now: () => clock, rootEmails: [ROOT] })
})

describe('reglas de salas', () => {
  it('extrae el código de un enlace o texto suelto', () => {
    expect(extractCode('https://lifehigh.site/sala/ab3k9mz')).toBe('ab3k9mz')
    expect(extractCode('  AB3K9MZ ')).toBe('ab3k9mz')
    for (const bad of ['', 'abc', 'ab3k9m0', 'https://x.com/otra/abcdefg', null]) expect(extractCode(bad)).toBeNull()
  })
  it('los códigos generados tienen el formato válido', () => {
    for (let i = 0; i < 200; i++) expect(CODE_RE.test(randomCode())).toBe(true)
  })
  it('valida el nombre, el horario y la película', () => {
    expect(validateRoomInput({ title: 'ab' }, T0).error).toBe('room_title_required')
    expect(validateRoomInput({ title: 'visita pirata.com' }, T0).error).toBe('text_links')
    expect(validateRoomInput({ title: 'Cine', startsAt: T0 + 20 * 86400000 }, T0).error).toBe('room_time_invalid')
    expect(validateRoomInput({ title: 'Cine', startsAt: T0 - 5 * 3_600_000 }, T0).error).toBe('room_time_invalid')
    expect(validateRoomInput({ title: 'Cine', item: { type: 'x', id: 1, title: 'a' } }, T0).error).toBe('bad_request')
    expect(validateRoomInput({ title: ' Noche  de terror ', startsAt: T0 + 3600_000, item: { type: 'movie', id: 603, title: 'Matrix', poster: '/p.jpg', year: '1999', note: 'x' } }, T0).value)
      .toEqual({ title: 'Noche de terror', startsAt: T0 + 3600_000, item: { type: 'movie', id: 603, title: 'Matrix', poster: '/p.jpg', year: '1999' } })
  })
  it('valida mensajes y calcula la fase y la cuenta regresiva', () => {
    expect(validateMessage('  hola   a todos ').value).toBe('hola a todos')
    expect(validateMessage('').error).toBe('message_empty')
    expect(validateMessage('mirá pirata.com').error).toBe('text_links')
    expect(validateMessage('x'.repeat(900)).value.length).toBe(ROOM.textMax)
    expect(validateMessage({}).error).toBe('bad_request')
    const r = { startsAt: T0 + 1000, expiresAt: T0 + ROOM.lifeMs, closedAt: null }
    expect(roomPhase(r, T0)).toBe('scheduled'); expect(roomPhase(r, T0 + 2000)).toBe('live')
    expect(roomPhase(r, T0 + ROOM.lifeMs + 1)).toBe('expired'); expect(roomPhase({ ...r, closedAt: 1 }, T0)).toBe('closed')
    expect(formatCountdown(754_000)).toBe('12:34'); expect(formatCountdown(3_725_000)).toBe('1:02:05'); expect(formatCountdown(-5)).toBe('0:00')
  })
})

describe('crear y ver una sala', () => {
  it('crear exige cuenta y mail confirmado o 1 h; el @usuario se crea solo', async () => {
    expect((await post('create', { title: 'Cine' }, H)).status).toBe(401)
    const sinPerfil = await mkUser(null)
    const made = await post('create', { title: 'Cine' }, sinPerfil.h)
    expect(made.status).toBe(200)
    expect(made.body.room.host.handle).toMatch(/^[a-z0-9_]{3,20}$/)
    expect((await social.getProfile(sinPerfil.user.id)).handle).toBe(made.body.room.host.handle)
    const nueva = await mkUser('nueva', { emailVerified: false, createdAt: T0 - 60_000 })
    expect((await post('create', { title: 'Cine' }, nueva.h)).body.error).toBe('cannot_publish_yet')
  })

  it('crea la sala con código, anfitrión adentro y horario; el enlace es público para ver', async () => {
    const ana = await mkUser('ana')
    const room = await open(ana, { startsAt: T0 + 30 * 60_000, item: { type: 'movie', id: 603, title: 'Matrix' } })
    expect(room.code).toMatch(CODE_RE)
    expect(room).toMatchObject({ title: 'Noche de terror', phase: 'scheduled', host: { handle: 'ana' }, online: 1, isHost: true, maxMembers: 12 })
    const pub = (await get('room', { code: room.code.toUpperCase() })).body.room            // sin sesión, y tolera mayúsculas
    expect(pub).toMatchObject({ title: 'Noche de terror', phase: 'scheduled', isHost: false, online: 1 })
    expect(JSON.stringify(pub)).not.toMatch(/ownerId|@mail\.com|userId/)
    expect((await get('room', { code: 'zzzzzzz' })).status).toBe(404)
    expect((await get('room', { code: "' || 1" })).status).toBe(404)
  })

  it('máximo 3 salas abiertas por persona y 5 creaciones por hora', async () => {
    const ana = await mkUser('ana')
    for (let i = 0; i < 3; i++) expect((await post('create', { title: `Sala ${i}` }, ana.h)).status).toBe(200)
    expect((await post('create', { title: 'Cuarta' }, ana.h)).body.error).toBe('room_limit')
    const bea = await mkUser('bea')
    let last
    for (let i = 0; i < 6; i++) { const r = await post('create', { title: `Sala ${i}` }, bea.h); if (r.status === 200) await post('close', { code: r.body.room.code }, bea.h); last = r }
    expect(last.status).toBe(429)
  })

  it('mis salas lista las que abrí o a las que entré', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const room = await open(ana)
    await post('join', { code: room.code }, bea.h)
    expect((await get('mine', {}, bea.h)).body.rooms.map((r) => r.code)).toEqual([room.code])
    expect((await get('mine', {}, ana.h)).body.rooms).toHaveLength(1)
    expect((await get('mine')).status).toBe(401)
  })
})

describe('entrar, chatear y reaccionar', () => {
  it('entrar anuncia, devuelve el estado y la lista de conectados', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const { code } = await open(ana)
    const j = await post('join', { code }, bea.h)
    expect(j.status).toBe(200)
    expect(j.body.members.map((m) => [m.handle, m.host, m.me])).toEqual([['ana', true, false], ['bea', false, true]])
    expect(j.body.messages.map((m) => m.text)).toEqual(['@ana abrió la sala', '@bea entró'])
    expect((await post('join', { code }, bea.h)).body.messages.map((m) => m.text)).not.toContain('@bea entró entró')   // volver a entrar no repite el aviso
    const sys = (await post('sync', { code, since: 0 }, bea.h)).body.messages.filter((m) => m.text === '@bea entró')
    expect(sys).toHaveLength(1)
  })

  it('sin cuenta o sin entrar no se puede chatear ni leer', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const { code } = await open(ana)
    expect((await post('say', { code, text: 'hola' }, H)).status).toBe(401)
    expect((await post('say', { code, text: 'hola' }, bea.h)).body.error).toBe('not_member')
    expect((await post('sync', { code, since: 0 }, bea.h)).body.error).toBe('not_member')
    expect((await post('join', { code }, H)).status).toBe(401)
  })

  it('el chat llega a los demás por sync con el cursor "since" y marca los mensajes propios', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const { code } = await open(ana)
    await post('join', { code }, bea.h)
    const first = await post('sync', { code, since: 0 }, ana.h)
    const cursor = first.body.seq
    const said = await post('say', { code, text: 'Hola a todos' }, bea.h)
    expect(said.body.message).toMatchObject({ handle: 'bea', text: 'Hola a todos', mine: true })
    const next = await post('sync', { code, since: cursor }, ana.h)
    expect(next.body.messages).toHaveLength(1)
    expect(next.body.messages[0]).toMatchObject({ kind: 'msg', handle: 'bea', text: 'Hola a todos', mine: false })
    expect((await post('sync', { code, since: next.body.seq }, ana.h)).body.messages).toHaveLength(0)
    expect(JSON.stringify(next.body)).not.toMatch(/userId|ownerId|@mail\.com/)
  })

  it('valida el texto: vacío, links y velocidad', async () => {
    const ana = await mkUser('ana')
    const { code } = await open(ana)
    expect((await post('say', { code, text: '   ' }, ana.h)).body.error).toBe('message_empty')
    expect((await post('say', { code, text: 'entren a pirata.com' }, ana.h)).body.error).toBe('text_links')
    expect((await post('say', { code, text: { $ne: 1 } }, ana.h)).status).toBe(400)
    let last
    for (let i = 0; i < 9; i++) last = await post('say', { code, text: `m${i}` }, ana.h)
    expect(last.status).toBe(429)
    clock += 11_000
    expect((await post('say', { code, text: 'ya puedo' }, ana.h)).status).toBe(200)
  })

  it('reacciones: solo emojis permitidos', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const { code } = await open(ana)
    await post('join', { code }, bea.h)
    expect((await post('react', { code, emoji: '🍿' }, bea.h)).status).toBe(200)
    expect((await post('react', { code, emoji: '💣' }, bea.h)).status).toBe(400)
    const msgs = (await post('sync', { code, since: 0 }, ana.h)).body.messages
    expect(msgs.find((m) => m.kind === 'react')).toMatchObject({ handle: 'bea', text: '🍿' })
  })

  it('la presencia expira si no hay latido y vuelve con el siguiente', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const { code } = await open(ana)
    await post('join', { code }, bea.h)
    clock += ROOM.onlineMs + 5_000
    await post('sync', { code, since: 0 }, ana.h)                         // solo ana late
    expect((await get('room', { code })).body.room.online).toBe(1)
    await post('sync', { code, since: 0 }, bea.h)
    expect((await get('room', { code })).body.room.online).toBe(2)
  })

  it('el primer sync trae solo los últimos mensajes (no todo el historial)', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const { code } = await open(ana)
    for (let i = 0; i < 80; i++) { await rooms.addMessage({ code, seq: await rooms.nextSeq(code), kind: 'msg', userId: ana.user.id, handle: 'ana', name: 'Ana', text: `m${i}`, at: clock }) }
    const j = await post('join', { code }, bea.h)
    expect(j.body.messages.length).toBeLessThanOrEqual(51)
    expect(j.body.messages.at(-1).text).toBe('@bea entró')
  })
})

describe('capacidad, anfitrión y cierre', () => {
  it('no entra más gente que el máximo', async () => {
    const ana = await mkUser('ana')
    const { code } = await open(ana)
    for (let i = 0; i < ROOM.maxMembers - 1; i++) { const u = await mkUser(`inv_${i}x`); expect((await post('join', { code }, u.h)).status).toBe(200) }
    const extra = await mkUser('sobra')
    expect((await post('join', { code }, extra.h)).body.error).toBe('room_full')
  })

  it('el anfitrión saca a alguien y esa persona no puede volver', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea'), cami = await mkUser('cami')
    const { code } = await open(ana)
    await post('join', { code }, bea.h)
    expect((await post('kick', { code, handle: 'bea' }, cami.h)).body.error).toBe('not_host')
    expect((await post('kick', { code, handle: 'ana' }, ana.h)).status).toBe(400)
    expect((await post('kick', { code, handle: 'bea' }, ana.h)).status).toBe(200)
    expect((await post('sync', { code, since: 0 }, bea.h)).body.error).toBe('kicked')
    expect((await post('join', { code }, bea.h)).body.error).toBe('kicked')
    expect((await post('say', { code, text: 'hola' }, bea.h)).status).toBe(403)
  })

  it('cambiar horario o película solo lo hace el anfitrión (o el fundador) y avisa en el chat', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea'), fundador = await mkUser('founder', { email: ROOT })
    const { code } = await open(ana, { startsAt: T0 + 3600_000 })
    expect((await post('update', { code, startsAt: T0 + 7200_000 }, bea.h)).body.error).toBe('not_host')
    const up = await post('update', { code, startsAt: T0 + 7200_000, title: 'Maratón' }, ana.h)
    expect(up.body.room).toMatchObject({ title: 'Maratón', startsAt: T0 + 7200_000 })
    expect((await post('update', { code, startsAt: T0 + 99 * 86400000 }, ana.h)).body.error).toBe('room_time_invalid')
    expect((await post('update', { code, startsAt: null }, fundador.h)).status).toBe(200)
    const room = await rooms.getRoom(code)
    expect(room.expiresAt).toBe(room.createdAt + ROOM.lifeMs)
    const texts = (await post('sync', { code, since: 0 }, ana.h)).body.messages.map((m) => m.text)
    expect(texts.some((t) => /cambió el horario/.test(t))).toBe(true)
  })

  it('cerrar la sala corta el chat y las entradas; el fundador también puede cerrarla', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea'), fundador = await mkUser('founder', { email: ROOT })
    const { code } = await open(ana)
    await post('join', { code }, bea.h)
    expect((await post('close', { code }, bea.h)).body.error).toBe('not_host')
    expect((await post('close', { code }, fundador.h)).status).toBe(200)
    expect((await get('room', { code })).body.room.phase).toBe('closed')
    expect((await post('say', { code, text: 'hola' }, bea.h)).status).toBe(410)
    const late = await mkUser('tarde')
    expect((await post('join', { code }, late.h)).status).toBe(410)
    expect((await get('mine', {}, ana.h)).body.rooms).toHaveLength(0)
  })

  it('una sala vence sola a las 12 h y se borra con todo a las 24 h', async () => {
    const ana = await mkUser('ana')
    const { code } = await open(ana)
    clock += ROOM.lifeMs + 1000
    expect((await get('room', { code })).body.room.phase).toBe('expired')
    expect((await post('say', { code, text: 'hola' }, ana.h)).status).toBe(410)
    clock += ROOM.keepAfterMs
    expect(await rooms.deleteExpired(clock)).toBe(1)
    expect((await get('room', { code })).status).toBe(404)
  })

  it('salir de la sala quita a la persona y avisa', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const { code } = await open(ana)
    await post('join', { code }, bea.h)
    await post('leave', { code }, bea.h)
    const s = await post('sync', { code, since: 0 }, ana.h)
    expect(s.body.members.map((m) => m.handle)).toEqual(['ana'])
    expect(s.body.messages.some((m) => m.text === '@bea salió')).toBe(true)
  })

  it('borrar la cuenta borra sus salas, su presencia y sus mensajes', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const mia = await open(ana)
    const otra = await open(bea, { title: 'Sala de Bea' })
    await post('join', { code: otra.code }, ana.h)
    await post('say', { code: otra.code, text: 'Mensaje de Ana' }, ana.h)
    await rooms.deleteUserData(ana.user.id)
    expect(await rooms.getRoom(mia.code)).toBeNull()
    expect(await rooms.getRoom(otra.code)).not.toBeNull()
    const s = await post('sync', { code: otra.code, since: 0 }, bea.h)
    expect(s.body.messages.some((m) => m.text === 'Mensaje de Ana')).toBe(false)
    expect(s.body.members.map((m) => m.handle)).toEqual(['bea'])
  })
})

describe('seguridad', () => {
  it('los POST exigen JSON y mismo origen; acciones raras no rompen', async () => {
    const ana = await mkUser('ana')
    expect((await post('create', { title: 'Cine' }, { ...ana.h, 'content-type': 'text/plain' })).status).toBe(415)
    expect((await post('create', { title: 'Cine' }, { ...ana.h, origin: 'https://malo.com' })).status).toBe(403)
    expect((await get('inexistente')).status).toBe(404)
    for (const body of [null, 'x', 5, [], { code: { $gt: '' } }, { code: ['a'] }]) expect([200, 400, 404]).toContain((await post('join', body, ana.h)).status)
  })
  it('un error interno no filtra detalles', async () => {
    const ana = await mkUser('ana')
    api = createRoomsApi({ store, social, rooms: { ...rooms, getRoom: async () => { throw new Error('mongodb://u:clave@host explotó') } }, now: () => clock })
    const r = await get('room', { code: 'abcdefg' }, ana.h)
    expect(r.status).toBe(500)
    expect(JSON.stringify(r.body)).toBe('{"error":"server_error"}')
  })
})

describe('sincronizar la película', () => {
  it('cada persona puede informar en qué minuto va; los demás lo ven y se limpia al cerrar el reproductor', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const { code } = await open(ana)
    await post('join', { code }, bea.h)
    await post('sync', { code, since: 0, pos: { t: 125.46, playing: true } }, ana.h)
    let s = await post('sync', { code, since: 0, pos: { t: 120, playing: false } }, bea.h)
    const byHandle = Object.fromEntries(s.body.members.map((m) => [m.handle, m.pos]))
    expect(byHandle.ana).toEqual({ t: 125.5, playing: true, at: clock })
    expect(byHandle.bea).toMatchObject({ t: 120, playing: false })
    await post('sync', { code, since: 0, pos: null }, bea.h)                                      // cerró el reproductor
    s = await post('sync', { code, since: 0 }, ana.h)
    expect(s.body.members.find((m) => m.handle === 'bea').pos).toBeNull()
    expect(s.body.members.find((m) => m.handle === 'ana').pos).not.toBeNull()                      // sin "pos" no se pisa lo anterior
  })

  it('una posición vieja deja de mostrarse y los valores raros se ignoran', async () => {
    const ana = await mkUser('ana')
    const { code } = await open(ana)
    await post('sync', { code, since: 0, pos: { t: 50, playing: true } }, ana.h)
    clock += 25_000
    expect((await post('sync', { code, since: 0 }, ana.h)).body.members[0].pos).toBeNull()
    for (const pos of [{ t: -5 }, { t: 'x' }, { t: 1e9 }, 'texto', { playing: true }]) {
      await post('sync', { code, since: 0, pos }, ana.h)
      expect((await post('sync', { code, since: 0 }, ana.h)).body.members[0].pos).toBeNull()
    }
  })

  it('el anfitrión lanza una cuenta regresiva común; el resto no puede', async () => {
    const ana = await mkUser('ana'), bea = await mkUser('bea')
    const { code } = await open(ana)
    await post('join', { code }, bea.h)
    expect((await post('countdown', { code, seconds: 5 }, bea.h)).body.error).toBe('not_host')
    expect((await post('countdown', { code, seconds: 5 }, H)).status).toBe(401)
    const r = await post('countdown', { code, seconds: 8 }, ana.h)
    expect(r.body.sync).toEqual({ id: 1, at: clock + 8000, seconds: 8 })
    const s = await post('sync', { code, since: 0 }, bea.h)
    expect(s.body.room.sync).toEqual({ id: 1, at: clock + 8000, seconds: 8 })
    expect(s.body.messages.some((m) => /Cuenta regresiva de 8 segundos/.test(m.text))).toBe(true)
    clock += 9000
    expect((await post('countdown', { code, seconds: 5 }, ana.h)).body.sync.id).toBe(2)             // cada una tiene su número
  })

  it('los segundos se acotan entre 5 y 15 y se limita la frecuencia', async () => {
    const ana = await mkUser('ana')
    const { code } = await open(ana)
    expect((await post('countdown', { code, seconds: 1 }, ana.h)).body.sync.seconds).toBe(5)
    expect((await post('countdown', { code, seconds: 99 }, ana.h)).body.sync.seconds).toBe(15)
    expect((await post('countdown', { code, seconds: 'x' }, ana.h)).body.sync.seconds).toBe(8)
    let last
    for (let i = 0; i < 4; i++) last = await post('countdown', { code, seconds: 5 }, ana.h)
    expect(last.status).toBe(429)
    await post('close', { code }, ana.h)
    clock += 61_000
    expect((await post('countdown', { code, seconds: 5 }, ana.h)).status).toBe(410)
  })
})
