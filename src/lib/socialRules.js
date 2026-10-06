// ─────────────────────────────────────────────────────────────────────────
// Reglas de la comunidad (perfiles, listas, likes). PURO: lo usan el navegador (para avisar antes de enviar)
// y el servidor (que vuelve a validar TODO: nunca se confía en lo que manda el cliente).
// ─────────────────────────────────────────────────────────────────────────

export const LIMITS = {
  free:    { lists: 3,   items: 50 },
  premium: { lists: 100, items: 200 },
  title: 80, description: 300, note: 140, bio: 160, report: 200,
}

export const TAGS = ['zapping', 'finde', 'maraton', 'familia', 'clasicos', 'otro']
export const TAG_LABELS = { zapping: 'Zapping', finde: 'Plan de finde', maraton: 'Maratón', familia: 'En familia', clasicos: 'Clásicos', otro: 'Otras' }

// ─── @usuario ───────────────────────────────────────────────────────────
export const HANDLE_RE = /^[a-z0-9_]{3,20}$/
const RESERVED = new Set([
  'admin', 'administrador', 'root', 'panel', 'api', 'lifehigh', 'life_high', 'life', 'soporte', 'support', 'ayuda', 'help',
  'moderador', 'moderacion', 'staff', 'oficial', 'official', 'sistema', 'system', 'null', 'undefined', 'cuenta', 'perfil',
  'comunidad', 'lista', 'listas', 'mi_lista', 'tintech', 'fundador',
])

export const normalizeHandle = (h) => String(h ?? '').trim().toLowerCase().replace(/^@/, '')

/** @returns {null | 'handle_invalid' | 'handle_reserved'} */
export const handleProblem = (handle) => {
  if (!HANDLE_RE.test(handle)) return 'handle_invalid'
  if (RESERVED.has(handle)) return 'handle_reserved'
  return null
}

// ─── Texto ──────────────────────────────────────────────────────────────
// No se permiten links en textos públicos (spam y phishing): ni http(s), ni www, ni dominios sueltos.
const URL_RE = /(https?:\/\/|www\.|ftp:|[a-z0-9-]{2,}\.(com|net|org|io|me|tv|ly|xyz|site|app|gg|co|ar|es|mx|cl|uy|pe|link|click|top|info|biz|online|store|shop|live|cc|to|vip)\b)/i

export const cleanText = (value, max) =>
  String(value ?? '').replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)

export const hasLink = (text) => URL_RE.test(String(text ?? ''))

// ─── Títulos dentro de una lista ────────────────────────────────────────
const KEY_RE = /^(movie|tv):\d{1,9}$/
const POSTER_RE = /^\/[A-Za-z0-9_.-]{1,60}$/

/** Devuelve un ítem limpio o null si es inválido. */
export const sanitizeItem = (x) => {
  if (!x || typeof x !== 'object') return null
  const type = x.type === 'tv' ? 'tv' : x.type === 'movie' ? 'movie' : null
  const id = Math.trunc(Number(x.id))
  if (!type || !Number.isFinite(id) || id <= 0 || id > 999999999) return null
  const title = cleanText(x.title, 120)
  if (!title) return null
  return {
    key: `${type}:${id}`, type, id, title,
    poster: typeof x.poster === 'string' && POSTER_RE.test(x.poster) ? x.poster : null,
    year: /^\d{4}$/.test(String(x.year ?? '')) ? String(x.year) : null,
    note: cleanText(x.note, LIMITS.note),
  }
}

export const planOf = (user) => (user?.premium ? 'premium' : 'free')

/**
 * Valida y limpia lo que manda el cliente para crear/editar una lista.
 * @returns {{ error: string } | { value: object }}
 */
export const validateListInput = (body, user) => {
  const plan = LIMITS[planOf(user)]
  if (!body || typeof body !== 'object') return { error: 'bad_request' }

  const title = cleanText(body.title, LIMITS.title)
  if (title.length < 3) return { error: 'title_required' }
  const description = cleanText(body.description, LIMITS.description)
  if (hasLink(title) || hasLink(description)) return { error: 'text_links' }

  const tag = TAGS.includes(body.tag) ? body.tag : 'otro'
  const visibility = body.visibility === 'private' ? 'private' : 'public'
  if (visibility === 'private' && !user?.premium) return { error: 'private_requires_premium' }

  const raw = Array.isArray(body.items) ? body.items : []
  const seen = new Set()
  const items = []
  for (const r of raw) {
    const it = sanitizeItem(r)
    if (!it || seen.has(it.key)) continue
    if (hasLink(it.note)) return { error: 'text_links' }
    seen.add(it.key)
    items.push(it)
  }
  if (items.length > plan.items) return { error: 'too_many_items' }

  return { value: { title, description, tag, visibility, items } }
}

export const validateBio = (bio) => {
  const text = cleanText(bio, LIMITS.bio)
  if (hasLink(text)) return { error: 'text_links' }
  return { value: text }
}

/** Mensajes en español para los códigos de error de la comunidad. */
export const SOCIAL_ERRORS = {
  handle_invalid: 'El usuario debe tener entre 3 y 20 caracteres: letras minúsculas, números o guión bajo.',
  handle_reserved: 'Ese nombre de usuario no está disponible.',
  handle_taken: 'Ese nombre de usuario ya lo usa otra persona.',
  handle_cooldown: 'Solo podés cambiar tu usuario una vez cada 30 días.',
  profile_required: 'Primero creá tu perfil (elegí tu @usuario).',
  title_required: 'Ponele un título a la lista (mínimo 3 letras).',
  text_links: 'Por seguridad no se permiten links en los textos.',
  too_many_items: 'La lista supera el máximo de títulos de tu plan.',
  list_limit: 'Llegaste al máximo de listas de tu plan.',
  private_requires_premium: 'Las listas privadas son parte de Premium.',
  not_found: 'No encontramos lo que buscabas.',
  forbidden: 'No tenés permiso para hacer eso.',
  cannot_publish_yet: 'Tu cuenta es muy nueva: confirmá tu mail o esperá una hora para publicar.',
  too_many_requests: 'Demasiadas acciones seguidas. Esperá unos minutos.',
  cannot_follow_self: 'No podés seguirte a vos mismo.',
  already_reported: 'Ya reportaste esta lista. Gracias.',
}
export const socialErrorMessage = (code) => SOCIAL_ERRORS[code] || 'Algo falló. Probá de nuevo en un rato.'
