// ─────────────────────────────────────────────────────────────────────────
// API del panel del fundador. SOLO para cuentas root (mail en ROOT_EMAILS y verificado).
//   GET realtime            → quién está conectado ahora y qué está viendo
//   GET dashboard?days=1|7|30 → tráfico, tiempo de visualización, títulos más vistos, audiencia, cuentas, embudo
// Para cualquiera que no sea root responde 404 (ni siquiera confirma que el panel existe).
// ─────────────────────────────────────────────────────────────────────────
import { authenticateSession, isRoot, checkWriteRequest } from './session.js'
import { dayKey, ONLINE_WINDOW_MS } from './pulse.js'
import { computeRetention } from './retention.js'

const RANGES = [1, 7, 30]

const addDays = (day, n) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
const windowDays = (endDay, n) => Array.from({ length: n }, (_, i) => addDays(endDay, -(n - 1 - i)))

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d
const pct = (cur, prev) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null)
const ratio = (a, b) => (b > 0 ? a / b : 0)

const sumInto = (target, source) => {
  if (!source || typeof source !== 'object') return        // tolera null / valores raros guardados en la base
  for (const [k, v] of Object.entries(source)) target[k] = (target[k] || 0) + num(v)
}
const ranked = (obj, limit = 10) =>
  Object.entries(obj).map(([label, value]) => ({ label, value })).filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, limit)

/** Suma los contadores diarios de una ventana. */
export const totalsOf = (dailies) => {
  const t = { visitors: 0, views: 0, watchSeconds: 0, plays: 0, activeSeconds: 0, members: 0, guests: 0, watchMember: 0, watchGuest: 0, ev: {}, byCountry: {}, byDevice: {}, byPlat: {}, pages: {}, hours: {} }
  for (const d of dailies) {
    t.visitors += num(d.visitors); t.views += num(d.views); t.watchSeconds += num(d.watchSeconds)
    t.plays += num(d.plays); t.activeSeconds += num(d.activeSeconds); t.members += num(d.members); t.guests += num(d.guests)
    t.watchMember += num(d.watch?.member); t.watchGuest += num(d.watch?.guest)
    sumInto(t.ev, d.ev); sumInto(t.byCountry, d.byCountry); sumInto(t.byDevice, d.byDevice)
    sumInto(t.byPlat, d.byPlat); sumInto(t.pages, d.pages); sumInto(t.hours, d.hours)
  }
  t.signups = num(t.ev.signup) + num(t.ev.signup_gate)
  return t
}

const maskEmail = (email = '') => {
  const [user, domain] = String(email).split('@')
  if (!domain) return '***'
  return `${user.slice(0, 2)}${'*'.repeat(Math.max(1, Math.min(4, user.length - 2)))}@${domain}`
}

/** Agrupa títulos de varios días por título. */
const aggregateTitles = (docs) => {
  const map = new Map()
  for (const d of docs) {
    const cur = map.get(d.key) || { key: d.key, title: d.title || d.key, type: d.type || d.key.split(':')[0], seconds: 0, plays: 0 }
    cur.seconds += num(d.seconds); cur.plays += num(d.plays)
    if (d.title) cur.title = d.title
    map.set(d.key, cur)
  }
  return [...map.values()]
}
const shapeTitle = (t) => ({ key: t.key, title: t.title, type: t.type, hours: round(t.seconds / 3600, 2), minutes: round(t.seconds / 60, 0), plays: t.plays })

export const createAdminApi = ({ store, stats, social = null, mail = null, rootEmails = [], now = Date.now }) => async ({ method, action, headers = {}, query = {}, body = {} }) => {
  const isModerate = method === 'POST' && action === 'moderate'
  const isWrite = isModerate || (method === 'POST' && action === 'mail-delete')
  if (method !== 'GET' && !isWrite) return { status: 405, body: { error: 'method_not_allowed' } }
  if (isWrite) {
    const bad = checkWriteRequest(Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])))
    if (bad) return { status: bad.status, body: { error: bad.error } }
  }
  const auth = await authenticateSession({ store, headers, now: now() })
  if (!auth) return { status: 401, body: { error: 'not_authenticated' } }
  if (!isRoot(auth.user, rootEmails)) return { status: 404, body: { error: 'not_found' } }

  const t = now()

  // ── Correo de info@lifehigh.site (enviados y recibidos) ──────────────
  if (action === 'mail' && mail) {
    const dir = query.dir === 'out' ? 'out' : 'in'
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(query.limit)) || 30))
    const before = Number(query.before) > 0 ? Number(query.before) : Infinity
    const [items, stats] = await Promise.all([mail.list({ dir, limit: limit + 1, before }), mail.stats()])
    return { status: 200, body: { dir, items: items.slice(0, limit), hasMore: items.length > limit, stats, unread: stats.unread } }
  }
  if (action === 'mail-item' && mail) {
    const m = await mail.get(String(query.id || ''))
    if (!m) return { status: 404, body: { error: 'not_found' } }
    if (m.dir === 'in' && !m.readAt) { await mail.markRead(m.id, t); m.readAt = t }
    return { status: 200, body: { item: m } }
  }
  if (action === 'mail-delete' && mail) {
    const ok = await mail.remove(String(body.id || ''))
    return { status: ok ? 200 : 404, body: ok ? { ok: true } : { error: 'not_found' } }
  }

  // ── Moderación de la comunidad ───────────────────────────────────────
  if (action === 'reports' && social) {
    const rows = await social.reportedLists(50)
    const out = []
    for (const r of rows) {
      if (String(r.listId).startsWith('c:')) {                          // reporte de un comentario / opinión
        const c = await social.getComment(String(r.listId).slice(2))
        if (!c) { await social.clearReports(r.listId); continue }
        const author = await social.getProfile(c.authorId)
        out.push({
          kind: 'comment', commentId: c.id, title: c.text, description: '', owner: author?.handle || '—', itemsCount: 0, target: c.target,
          hidden: !!c.hidden, reports: r.count, reasons: r.reasons.slice(0, 3), sample: [],
        })
        continue
      }
      const l = await social.getList(r.listId)
      if (!l) { await social.clearReports(r.listId); continue }        // la lista ya no existe
      const owner = await social.getProfile(l.ownerId)
      out.push({
        listId: l.id, title: l.title, description: l.description, owner: owner?.handle || '—', itemsCount: l.items.length,
        hidden: !!l.hidden, reports: r.count, reasons: r.reasons.slice(0, 3), sample: l.items.slice(0, 5).map((i) => i.title),
      })
    }
    return { status: 200, body: { reports: out } }
  }
  if (isModerate && social && body.commentId) {
    const cid = String(body.commentId)
    const c = await social.getComment(cid)
    if (!c) return { status: 404, body: { error: 'not_found' } }
    switch (body.decision) {
      case 'hide': await social.updateComment(cid, { hidden: true }); break
      case 'unhide': await social.updateComment(cid, { hidden: false }); break
      case 'dismiss': await social.clearReports(`c:${cid}`); await social.updateComment(cid, { hidden: false }); break
      case 'delete': await social.deleteComment(cid); break
      default: return { status: 400, body: { error: 'bad_request' } }
    }
    return { status: 200, body: { ok: true } }
  }
  if (isModerate && social) {
    const id = String(body.listId || '')
    const l = await social.getList(id)
    if (!l) return { status: 404, body: { error: 'not_found' } }
    switch (body.decision) {
      case 'hide': await social.updateList(id, { hidden: true }); break
      case 'unhide': await social.updateList(id, { hidden: false }); break
      case 'dismiss': await social.clearReports(id); await social.updateList(id, { hidden: false }); break    // falsa alarma
      case 'delete': await social.deleteList(id); break
      default: return { status: 400, body: { error: 'bad_request' } }
    }
    return { status: 200, body: { ok: true } }
  }

  // ── En vivo ──────────────────────────────────────────────────────────
  if (action === 'realtime') {
    const online = await stats.listOnline(t - ONLINE_WINDOW_MS)
    const watching = online.filter((p) => p.state === 'watch')
    const byTitle = {}
    for (const p of watching) {
      const e = (byTitle[p.wkey] ||= { key: p.wkey, title: p.wtitle || p.wkey, viewers: 0 })
      e.viewers += 1
    }
    const count = (list, field) => list.reduce((acc, p) => { acc[p[field] || '—'] = (acc[p[field] || '—'] || 0) + 1; return acc }, {})
    return {
      status: 200,
      body: {
        demo: !!stats.demo,
        generatedAt: t,
        online: online.length,
        watching: watching.length,
        browsing: online.length - watching.length,
        members: online.filter((p) => p.member).length,
        guests: online.filter((p) => !p.member).length,
        nowPlaying: Object.values(byTitle).sort((a, b) => b.viewers - a.viewers).slice(0, 10),
        byCountry: ranked(count(online, 'country'), 8),
        byPlatform: ranked(count(online, 'plat'), 6),
        byDevice: ranked(count(online, 'device'), 4),
        byPage: ranked(count(online, 'page'), 8),
      },
    }
  }

  // ── Panel completo ───────────────────────────────────────────────────
  if (action === 'dashboard') {
    const n = RANGES.includes(Number(query.days)) ? Number(query.days) : 7
    const today = dayKey(t)
    const cur = windowDays(today, n)
    const prev = windowDays(addDays(today, -n), n)

    const [dailies, prevDailies, titleDocs, users] = await Promise.all([
      stats.getDailies(cur), stats.getDailies(prev), stats.getTitles(cur), store.userStats(t - 31 * 86400000),
    ])
    const tot = totalsOf(dailies)
    const ptot = totalsOf(prevDailies)
    // Retención: solo cuentas reales (el fundador no cuenta). Usa los días en que cada persona abrió la app con su cuenta.
    const retentionOf = async () => {
      const rows = await store.activityRows(t - 90 * 86400000, addDays(today, -31))
      return computeRetention(rows.filter((u) => !isRoot({ email: u.email, emailVerified: true }, rootEmails)), t)
    }

    const series = dailies.map((d) => ({
      date: d.day || d._id,
      visitors: num(d.visitors),
      pageviews: num(d.views),                              // el AreaChart del panel viejo espera este nombre
      watchHours: round(num(d.watchSeconds) / 3600, 2),
      plays: num(d.plays),
      signups: num(d.ev?.signup) + num(d.ev?.signup_gate),
    }))

    const titles = aggregateTitles(titleDocs)
    const byType = { movie: 0, tv: 0 }
    for (const x of titles) byType[x.type === 'tv' ? 'tv' : 'movie'] += x.seconds

    const hours = Array.from({ length: 24 }, (_, i) => {
      const h = String(i).padStart(2, '0')
      return { label: `${h}:00`, value: num(tot.hours[h]) }
    })

    const gateShown = num(tot.ev.gate_shown_watch) + num(tot.ev.gate_shown_list)
    const dayCounts = {}
    for (const ts of users.createdSince || []) { const k = dayKey(ts); dayCounts[k] = (dayCounts[k] || 0) + 1 }
    const newByDay = windowDays(today, 30).map((date) => ({ date, count: dayCounts[date] || 0 }))

    return {
      status: 200,
      body: {
        demo: !!stats.demo,
        generatedAt: t,
        range: { days: n, from: cur[0], to: today, timezone: 'America/Argentina/Buenos_Aires' },
        totals: {
          visitors: tot.visitors, pageviews: tot.views, plays: tot.plays,
          watchSeconds: Math.round(tot.watchSeconds),
          watchHours: round(tot.watchSeconds / 3600, 3),            // 3 decimales: con poco tráfico 2 minutos no deben verse como 0
          avgWatchMinutesPerPlay: round(ratio(tot.watchSeconds, tot.plays) / 60, 1),
          avgSiteMinutesPerVisitor: round(ratio(tot.activeSeconds, tot.visitors) / 60, 1),
          watchMinutesPerVisitor: round(ratio(tot.watchSeconds, tot.visitors) / 60, 1),
          signups: tot.signups,
        },
        deltas: {
          visitors: pct(tot.visitors, ptot.visitors), pageviews: pct(tot.views, ptot.views),
          watchHours: pct(tot.watchSeconds, ptot.watchSeconds), plays: pct(tot.plays, ptot.plays), signups: pct(tot.signups, ptot.signups),
        },
        series,
        hours,
        topByTime: titles.slice().sort((a, b) => b.seconds - a.seconds).filter((x) => x.seconds > 0).slice(0, 10).map(shapeTitle),
        topByPlays: titles.slice().sort((a, b) => b.plays - a.plays).filter((x) => x.plays > 0).slice(0, 10).map(shapeTitle),
        watchByType: { movieHours: round(byType.movie / 3600, 3), tvHours: round(byType.tv / 3600, 3) },
        audience: {
          countries: ranked(tot.byCountry, 10), devices: ranked(tot.byDevice, 4),
          platforms: ranked(tot.byPlat, 6), pages: ranked(tot.pages, 10),
          members: tot.members, guests: tot.guests,
          watchHoursMembers: round(tot.watchMember / 3600, 3), watchHoursGuests: round(tot.watchGuest / 3600, 3),
        },
        community: social ? await social.stats() : null,
        mail: mail ? await mail.stats() : null,
        retention: await retentionOf(),
        funnel: {
          gateShown, gateShownWatch: num(tot.ev.gate_shown_watch), gateShownList: num(tot.ev.gate_shown_list),
          signupsFromGate: num(tot.ev.signup_gate), signupsOther: num(tot.ev.signup), logins: num(tot.ev.login),
          conversionPct: gateShown > 0 ? round((num(tot.ev.signup_gate) / gateShown) * 100, 1) : null,
          donateShown: num(tot.ev.donate_shown), donateClicks: num(tot.ev.donate_click),
          donateCtrPct: num(tot.ev.donate_shown) > 0 ? round((num(tot.ev.donate_click) / num(tot.ev.donate_shown)) * 100, 1) : null,
        },
        users: {
          total: users.total, google: users.google, withPassword: users.password, verified: users.verified, supporters: users.supporters,
          last24h: (users.createdSince || []).filter((ts) => t - ts <= 86400000).length,
          last7d: (users.createdSince || []).filter((ts) => t - ts <= 7 * 86400000).length,
          newByDay,
          recent: (users.recent || []).map((u) => ({ email: maskEmail(u.email), name: u.name || '', google: !!u.google, createdAt: u.createdAt })),
        },
      },
    }
  }

  return { status: 404, body: { error: 'not_found' } }
}
