// ─────────────────────────────────────────────────────────────────────────
// API de la comunidad: perfiles (@usuario), listas públicas, likes, seguir, feed y reportes.
//
//  · Leer perfiles y listas públicas es libre (sirve para compartir por WhatsApp); interactuar requiere cuenta.
//  · El servidor vuelve a validar TODO (src/lib/socialRules.js). Sin links en textos, límites por plan, rate limits.
//  · Privacidad por defecto: sin perfil no hay nada público; el historial de lo que mirás NUNCA se muestra.
//  · Moderación: 3 reportes distintos ocultan una lista automáticamente; el fundador revisa desde /panel.
// ─────────────────────────────────────────────────────────────────────────
import { authenticateSession, isRoot, checkWriteRequest } from './session.js'
import {
  LIMITS, planOf, normalizeHandle, handleProblem, cleanText, hasLink, sanitizeItem, validateListInput, validateBio,
} from '../../src/lib/socialRules.js'

const HOUR = 3_600_000
const DAY = 24 * HOUR
const NEW_ACCOUNT_WAIT_MS = HOUR
const HANDLE_COOLDOWN_MS = 30 * DAY
const AUTO_HIDE_REPORTS = 3
const POPULAR_WINDOW_MS = 60 * DAY
const FEED_LIMIT = 24

const STATUS = {
  not_found: 404, forbidden: 403, list_limit: 403, private_requires_premium: 403, cannot_publish_yet: 403, cannot_follow_self: 400,
  handle_taken: 409, handle_cooldown: 429, too_many_requests: 429, not_authenticated: 401, profile_required: 400,
}

/** @param {{ store, social, now?: () => number, rootEmails?: string[] }} deps */
export const createSocialApi = ({ store, social, now = Date.now, rootEmails = [] }) => {
  const reply = (status, body) => ({ status, body })
  const ok = (body = { ok: true }) => reply(200, body)
  const fail = (code, status) => reply(status || STATUS[code] || 400, { error: code })

  const limited = async (key, max, windowMs) => (await store.hit(key, windowMs, now())) > max
  const canPublish = (user) => user.emailVerified === true || now() - (user.createdAt || 0) >= NEW_ACCOUNT_WAIT_MS

  // ─── Armado de respuestas ───────────────────────────────────────────
  const ownersMap = async (lists) => {
    const ids = [...new Set(lists.map((l) => l.ownerId))]
    const profiles = await social.getProfilesByIds(ids)
    return new Map(profiles.map((p) => [p.userId, p]))
  }
  const ownerShape = (p) => (p ? { handle: p.handle, name: p.name } : null)
  const summary = (l, owner, { liked = false, forOwner = false } = {}) => ({
    id: l.id, title: l.title, description: l.description, tag: l.tag, visibility: l.visibility,
    itemsCount: l.items.length, cover: l.items.map((i) => i.poster).filter(Boolean).slice(0, 4),
    likes: l.likes || 0, liked, owner: ownerShape(owner), createdAt: l.createdAt, updatedAt: l.updatedAt,
    ...(forOwner ? { hidden: !!l.hidden } : {}),
  })
  const summaries = async (lists, viewer) => {
    const owners = await ownersMap(lists)
    const liked = viewer ? await social.likedSet(viewer.id, lists.map((l) => l.id)) : new Set()
    return lists.map((l) => summary(l, owners.get(l.ownerId), { liked: liked.has(l.id) }))
  }

  const planInfo = (user) => ({ premium: !!user.premium, maxLists: LIMITS[planOf(user)].lists, maxItems: LIMITS[planOf(user)].items })

  // ─── Acciones ───────────────────────────────────────────────────────
  const actions = {
    // Perfil público (libre)
    'GET profile': async ({ query, viewer }) => {
      const handle = normalizeHandle(query.handle)
      const p = handleProblem(handle) === 'handle_invalid' ? null : await social.getProfileByHandle(handle)
      if (!p) return fail('not_found')
      const [lists, followers, following, isFollowing] = await Promise.all([
        social.queryLists({ ownerIds: [p.userId], sort: 'new', limit: 50 }),
        social.countFollowers(p.userId), social.countFollowing(p.userId),
        viewer ? social.isFollowing(viewer.id, p.userId) : false,
      ])
      return ok({
        profile: { handle: p.handle, name: p.name, bio: p.bio, createdAt: p.createdAt, followers, following, lists: lists.length },
        lists: await summaries(lists, viewer),
        viewer: { isMe: !!viewer && viewer.id === p.userId, following: !!isFollowing },
      })
    },

    // Mi perfil y mis listas (incluye privadas y ocultas)
    'GET me': async ({ viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const [profile, lists] = await Promise.all([social.getProfile(viewer.id), social.listsByOwner(viewer.id)])
      const shaped = lists.map((l) => summary(l, profile, { forOwner: true }))
      const followers = profile ? await social.countFollowers(viewer.id) : 0
      const following = await social.countFollowing(viewer.id)
      return ok({
        profile: profile ? { handle: profile.handle, name: profile.name, bio: profile.bio, followers, following } : null,
        lists: shaped, plan: planInfo(viewer), canPublish: canPublish(viewer),
      })
    },

    // Crear / editar mi perfil
    'POST profile': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (!canPublish(viewer)) return fail('cannot_publish_yet')
      if (await limited(`soc:profile:${viewer.id}`, 20, HOUR)) return fail('too_many_requests')

      const handle = normalizeHandle(body.handle)
      const problem = handleProblem(handle)
      if (problem) return fail(problem, 400)
      const name = cleanText(body.name || viewer.name || handle, 40)
      const bio = validateBio(body.bio)
      if (bio.error || hasLink(name)) return fail('text_links')

      const existing = await social.getProfile(viewer.id)
      try {
        if (existing) {
          const changing = handle !== existing.handle
          if (changing && now() - (existing.handleChangedAt || 0) < HANDLE_COOLDOWN_MS) return fail('handle_cooldown')
          const saved = await social.updateProfile(viewer.id, { handle, name, bio: bio.value, ...(changing ? { handleChangedAt: now() } : {}) })
          return ok({ profile: { handle: saved.handle, name: saved.name, bio: saved.bio } })
        }
        const created = await social.createProfile({ userId: viewer.id, handle, name, bio: bio.value, createdAt: now(), handleChangedAt: 0 })
        return ok({ profile: { handle: created.handle, name: created.name, bio: created.bio } })
      } catch (e) {
        if (e?.code === 'handle_taken') return fail('handle_taken')
        throw e
      }
    },

    // Una lista (pública, o mía)
    'GET list': async ({ query, viewer }) => {
      const l = await social.getList(String(query.id || ''))
      if (!l) return fail('not_found')
      const isOwner = !!viewer && viewer.id === l.ownerId
      const viewerIsRoot = !!viewer && isRoot(viewer, rootEmails)
      if (!isOwner && !viewerIsRoot && (l.visibility !== 'public' || l.hidden)) return fail('not_found')
      const owner = await social.getProfile(l.ownerId)
      const liked = viewer ? (await social.likedSet(viewer.id, [l.id])).has(l.id) : false
      return ok({
        list: { ...summary(l, owner, { liked, forOwner: isOwner || viewerIsRoot }), items: l.items },
        viewer: { isOwner, liked },
      })
    },

    // Crear o editar una lista
    'POST list': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (!canPublish(viewer)) return fail('cannot_publish_yet')
      const profile = await social.getProfile(viewer.id)
      if (!profile) return fail('profile_required')
      if (await limited(`soc:list:${viewer.id}`, 30, HOUR)) return fail('too_many_requests')

      const checked = validateListInput(body, viewer)
      if (checked.error) return fail(checked.error, 400)

      if (body.id) {
        const cur = await social.getList(String(body.id))
        if (!cur || cur.ownerId !== viewer.id) return fail(cur ? 'forbidden' : 'not_found')
        const saved = await social.updateList(cur.id, { ...checked.value, updatedAt: now() })
        return ok({ list: summary(saved, profile, { forOwner: true }) })
      }
      if ((await social.countListsByOwner(viewer.id)) >= LIMITS[planOf(viewer)].lists) return fail('list_limit')
      const created = await social.createList({ ownerId: viewer.id, ...checked.value, createdAt: now(), updatedAt: now() })
      return ok({ list: summary(created, profile, { forOwner: true }) })
    },

    // Agregar un título a una de mis listas (desde la ficha de una película)
    'POST list-add': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (!canPublish(viewer)) return fail('cannot_publish_yet')
      if (await limited(`soc:add:${viewer.id}`, 120, HOUR)) return fail('too_many_requests')
      const l = await social.getList(String(body.id || ''))
      if (!l) return fail('not_found')
      if (l.ownerId !== viewer.id) return fail('forbidden')
      const item = sanitizeItem(body.item)
      if (!item) return fail('bad_request', 400)
      if (hasLink(item.note)) return fail('text_links')
      if (l.items.some((i) => i.key === item.key)) return ok({ added: false, itemsCount: l.items.length })
      if (l.items.length >= LIMITS[planOf(viewer)].items) return fail('too_many_items', 400)
      const saved = await social.updateList(l.id, { items: [...l.items, item], updatedAt: now() })
      return ok({ added: true, itemsCount: saved.items.length })
    },

    'POST list-delete': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      const l = await social.getList(String(body.id || ''))
      if (!l) return fail('not_found')
      if (l.ownerId !== viewer.id) return fail('forbidden')
      await social.deleteList(l.id)
      return ok()
    },

    'POST like': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (await limited(`soc:like:${viewer.id}`, 200, HOUR)) return fail('too_many_requests')
      const l = await social.getList(String(body.id || ''))
      if (!l || (l.visibility !== 'public' && l.ownerId !== viewer.id) || (l.hidden && l.ownerId !== viewer.id)) return fail('not_found')
      if (body.on === false) { if (await social.removeLike(viewer.id, l.id)) await social.incListLikes(l.id, -1) }
      else if (await social.addLike(viewer.id, l.id)) await social.incListLikes(l.id, 1)
      const fresh = await social.getList(l.id)
      return ok({ liked: body.on !== false, likes: fresh?.likes || 0 })
    },

    'POST follow': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (await limited(`soc:follow:${viewer.id}`, 100, HOUR)) return fail('too_many_requests')
      const target = await social.getProfileByHandle(normalizeHandle(body.handle))
      if (!target) return fail('not_found')
      if (target.userId === viewer.id) return fail('cannot_follow_self')
      if (body.on === false) await social.removeFollow(viewer.id, target.userId)
      else await social.addFollow(viewer.id, target.userId)
      return ok({ following: body.on !== false, followers: await social.countFollowers(target.userId) })
    },

    // Feed: "following" (los que sigo), "popular" o "new"
    'GET feed': async ({ query, viewer }) => {
      const kind = ['following', 'popular', 'new'].includes(query.kind) ? query.kind : 'new'
      let lists
      if (kind === 'following') {
        if (!viewer) return fail('not_authenticated')
        const ids = await social.followingIds(viewer.id)
        lists = ids.length ? await social.queryLists({ ownerIds: ids, sort: 'new', limit: FEED_LIMIT }) : []
      } else if (kind === 'popular') {
        lists = await social.queryLists({ sort: 'popular', sinceMs: now() - POPULAR_WINDOW_MS, limit: FEED_LIMIT })
      } else {
        lists = await social.queryLists({ sort: 'new', limit: FEED_LIMIT })
      }
      return ok({ kind, lists: await summaries(lists, viewer) })
    },

    'POST report': async ({ body, viewer }) => {
      if (!viewer) return fail('not_authenticated')
      if (await limited(`soc:report:${viewer.id}`, 20, HOUR)) return fail('too_many_requests')
      const l = await social.getList(String(body.id || ''))
      if (!l || l.visibility !== 'public') return fail('not_found')
      if (l.ownerId === viewer.id) return fail('forbidden')
      const { added, distinct } = await social.addReport({ listId: l.id, reporter: viewer.id, reason: cleanText(body.reason, LIMITS.report), at: now() })
      if (distinct >= AUTO_HIDE_REPORTS && !l.hidden) await social.updateList(l.id, { hidden: true })
      return ok({ reported: true, already: !added })
    },
  }

  return async ({ method, action, headers = {}, body, query = {}, ip }) => { // eslint-disable-line no-unused-vars
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
      console.error('[social]', action, e?.message)
      return fail('server_error', 500)
    }
  }
}
