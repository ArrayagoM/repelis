// ─────────────────────────────────────────────────────────────────────────
// Reglas de las SALAS (cine digital): puras, las usan el navegador y el servidor (que vuelve a validar todo).
// ─────────────────────────────────────────────────────────────────────────
import { cleanText, hasLink, sanitizeItem } from './socialRules.js'

export const ROOM = {
  maxMembers: 12,          // personas a la vez (después de la fase de voz se revisa)
  maxActivePerOwner: 3,
  titleMax: 60,
  textMax: 300,
  lifeMs: 12 * 3_600_000,  // una sala vive 12 h desde que arranca (o desde que se crea)
  keepAfterMs: 24 * 3_600_000, // después se borra todo (mensajes incluidos)
  onlineMs: 30_000,        // "conectado" = latido en los últimos 30 s
  kickedKeep: 50,
  maxAheadMs: 14 * 86_400_000,
}

/** Sincronización de la película: cuenta regresiva común y posición de cada persona (si su reproductor la informa). */
export const SYNC = { minSeconds: 5, maxSeconds: 15, defaultSeconds: 8, posFreshMs: 20_000, maxPosSeconds: 172_800 }

/** @returns {{ t: number, playing: boolean } | null | undefined}  undefined = no vino; null = limpiar */
export const normalizePos = (pos) => {
  if (pos === undefined) return undefined
  if (pos === null) return null
  const t = Number(pos?.t)
  if (!Number.isFinite(t) || t < 0 || t > SYNC.maxPosSeconds) return undefined
  return { t: Math.round(t * 10) / 10, playing: pos.playing === true }
}

export const EMOJIS = ['👏', '😂', '😱', '😍', '🍿', '🔥']

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'     // sin letras/números que se confunden (0 o, 1 l i)
export const CODE_RE = /^[a-hj-km-np-z2-9]{7}$/
export const normalizeCode = (c) => String(c ?? '').trim().toLowerCase()
export const randomCode = (rand = Math.random) => Array.from({ length: 7 }, () => CODE_ALPHABET[Math.floor(rand() * CODE_ALPHABET.length)]).join('')

/** Acepta un código suelto o un enlace /sala/<código> y devuelve el código normalizado (o null). */
export const extractCode = (input) => {
  const raw = String(input ?? '').trim()
  const m = /\/sala\/([A-Za-z0-9]{7})/.exec(raw)
  const code = normalizeCode(m ? m[1] : raw)
  return CODE_RE.test(code) ? code : null
}

/** @returns {{ error: string } | { value: { title, startsAt, item } }} */
export const validateRoomInput = (body, now = Date.now()) => {
  if (!body || typeof body !== 'object') return { error: 'bad_request' }
  const title = cleanText(body.title, ROOM.titleMax)
  if (title.length < 3) return { error: 'room_title_required' }
  if (hasLink(title)) return { error: 'text_links' }

  let startsAt = null
  if (body.startsAt !== undefined && body.startsAt !== null && body.startsAt !== '') {
    const t = Math.trunc(Number(body.startsAt))
    if (!Number.isFinite(t) || t < now - 3_600_000 || t > now + ROOM.maxAheadMs) return { error: 'room_time_invalid' }
    startsAt = t
  }
  let item = null
  if (body.item) {
    item = sanitizeItem(body.item)
    if (!item) return { error: 'bad_request' }
    item = { type: item.type, id: item.id, title: item.title, poster: item.poster, year: item.year }
  }
  return { value: { title, startsAt, item } }
}

/** @returns {{ error: string } | { value: string }} */
export const validateMessage = (text) => {
  if (typeof text !== 'string') return { error: 'bad_request' }
  const clean = cleanText(text, ROOM.textMax)
  if (!clean) return { error: 'message_empty' }
  if (hasLink(clean)) return { error: 'text_links' }
  return { value: clean }
}

/** Estado de la sala según la hora: 'scheduled' (todavía no arranca) | 'live' | 'closed' | 'expired' */
export const roomPhase = (room, now = Date.now()) => {
  if (!room) return 'closed'
  if (room.closedAt) return 'closed'
  if (now >= room.expiresAt) return 'expired'
  return room.startsAt && now < room.startsAt ? 'scheduled' : 'live'
}

/** "12:05" / "1:02:09" para la cuenta regresiva. */
export const formatCountdown = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const mm = String(m).padStart(2, '0'), ss = String(r).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`
}

export const ROOM_ERRORS = {
  room_title_required: 'Ponele un nombre a la sala (mínimo 3 letras).',
  room_time_invalid: 'Elegí un horario entre ahora y los próximos 14 días.',
  room_limit: 'Ya tenés 3 salas abiertas. Cerrá una para abrir otra.',
  room_full: 'La sala está llena (máximo 12 personas).',
  room_closed: 'Esta sala ya terminó.',
  room_not_found: 'No encontramos esa sala. Revisá el código o el enlace.',
  kicked: 'El anfitrión te sacó de esta sala.',
  not_member: 'Primero tenés que entrar a la sala.',
  message_empty: 'Escribí un mensaje.',
  too_fast: 'Vas muy rápido: esperá un segundo entre mensajes.',
  bad_emoji: 'Esa reacción no está disponible.',
  not_host: 'Solo el anfitrión puede hacer eso.',
  sync_fast: 'Esperá un momento antes de pedir otra cuenta regresiva.',
  cannot_kick_self: 'No podés sacarte a vos mismo: cerrá la sala o salí.',
}
