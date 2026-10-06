import { describe, it, expect, beforeEach } from 'vitest'
import { createAdminApi, totalsOf } from '../_lib/adminApi.js'
import { createPulse, dayKey, ONLINE_WINDOW_MS } from '../_lib/pulse.js'
import { createMemoryStats } from '../_lib/statsStore.js'
import { createMemoryStore } from '../_lib/stores.js'
import { createAuthApi } from '../_lib/authApi.js'
import { parseRootEmails, isRoot } from '../_lib/session.js'
import { sha256 } from '../_lib/passwords.js'

const T0 = Date.UTC(2026, 9, 6, 15, 0, 0)
const ROOT = 'fundador@mail.com'
const hdr = (country = 'AR', ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120') => ({ 'x-vercel-ip-country': country, 'user-agent': ua })

let store, stats, clock, pulse, admin

const session = async (user) => {
  const token = `tok-${user.id}`
  await store.createSession({ id: sha256(token), userId: user.id, ua: '', createdAt: clock, expiresAt: clock + 86400000 })
  return { cookie: `lh_session=${token}` }
}
const mkUser = (over = {}) => store.createUser({ email: 'u@mail.com', name: 'U', emailVerified: true, createdAt: clock, library: {}, ...over })
const call = (action, headers, query = {}, method = 'GET') => admin({ method, action, headers, query })

// Simula un visitante: latidos cada 30 s
const visit = async ({ sid, country = 'AR', member = false, plat = 'web', page = 'home', watch, beats = 1, ua }) => {
  for (let i = 0; i < beats; i++) {
    await pulse({ body: { k: 'hb', sid, page, plat, member, nav: i === 0, ...(watch ? { w: watch } : {}) }, headers: hdr(country, ua) })
    clock += 30_000
  }
}
const sidOf = (n) => `visitor-${String(n).padStart(12, '0')}`

beforeEach(async () => {
  store = createMemoryStore()
  stats = createMemoryStats()
  clock = T0
  pulse = createPulse({ stats, now: () => clock })
  admin = createAdminApi({ store, stats, rootEmails: [ROOT], now: () => clock })
})

describe('rol root', () => {
  it('parseRootEmails limpia, pasa a minúsculas y descarta basura', () => {
    expect(parseRootEmails(' A@x.com, b@Y.com;  ;zzz ')).toEqual(['a@x.com', 'b@y.com'])
    expect(parseRootEmails('')).toEqual([])
    expect(parseRootEmails(undefined)).toEqual([])
  })
  it('isRoot exige mail en la lista Y verificado', () => {
    expect(isRoot({ email: 'A@X.com', emailVerified: true }, ['a@x.com'])).toBe(true)
    expect(isRoot({ email: 'a@x.com', emailVerified: false }, ['a@x.com'])).toBe(false)
    expect(isRoot({ email: 'otro@x.com', emailVerified: true }, ['a@x.com'])).toBe(false)
    expect(isRoot(null, ['a@x.com'])).toBe(false)
    expect(isRoot({ email: 'a@x.com', emailVerified: true }, [])).toBe(false)
  })
  it('la cuenta root se reconoce en la respuesta de /me (lo decide el servidor)', async () => {
    const auth = createAuthApi({ store, rootEmails: [ROOT], now: () => clock })
    const u = await mkUser({ email: ROOT })
    const res = await auth({ method: 'GET', action: 'me', headers: await session(u), ip: '1.1.1.1' })
    expect(res.body.user.root).toBe(true)
    const other = await mkUser({ email: 'normal@mail.com' })
    const res2 = await auth({ method: 'GET', action: 'me', headers: await session(other), ip: '1.1.1.1' })
    expect(res2.body.user.root).toBe(false)
  })
})

describe('permisos del panel', () => {
  it('sin sesión: 401', async () => {
    expect((await call('dashboard', {})).status).toBe(401)
    expect((await call('realtime', {})).status).toBe(401)
  })
  it('usuario común: 404 (ni confirma que el panel existe)', async () => {
    const h = await session(await mkUser({ email: 'normal@mail.com' }))
    expect((await call('dashboard', h)).status).toBe(404)
    expect((await call('realtime', h)).status).toBe(404)
  })
  it('root con mail SIN verificar: 404', async () => {
    const h = await session(await mkUser({ email: ROOT, emailVerified: false }))
    expect((await call('dashboard', h)).status).toBe(404)
  })
  it('root verificado: 200; solo GET; acciones desconocidas 404', async () => {
    const h = await session(await mkUser({ email: ROOT }))
    expect((await call('dashboard', h)).status).toBe(200)
    expect((await call('realtime', h)).status).toBe(200)
    expect((await call('dashboard', h, {}, 'POST')).status).toBe(405)
    expect((await call('borrar-todo', h)).status).toBe(404)
  })
  it('una sesión vencida no sirve', async () => {
    const u = await mkUser({ email: ROOT })
    const h = await session(u)
    clock += 2 * 86400000
    expect((await call('dashboard', h)).status).toBe(401)
  })
})

describe('en vivo', () => {
  it('cuenta conectados, viendo, miembros e invitados, y agrupa por título', async () => {
    const h = await session(await mkUser({ email: ROOT }))
    await visit({ sid: sidOf(1), watch: { key: 'movie:603', title: 'Matrix' }, member: true, country: 'AR' })
    await visit({ sid: sidOf(2), watch: { key: 'movie:603', title: 'Matrix' }, country: 'MX' })
    await visit({ sid: sidOf(3), watch: { key: 'tv:1396', title: 'Breaking Bad' }, country: 'AR' })
    await visit({ sid: sidOf(4), page: 'search', country: 'AR' })
    clock -= 30_000
    const { body } = await call('realtime', h)
    expect(body).toMatchObject({ online: 4, watching: 3, browsing: 1, members: 1, guests: 3 })
    expect(body.nowPlaying[0]).toEqual({ key: 'movie:603', title: 'Matrix', viewers: 2 })
    expect(body.nowPlaying[1]).toEqual({ key: 'tv:1396', title: 'Breaking Bad', viewers: 1 })
    expect(body.byCountry[0]).toEqual({ label: 'AR', value: 3 })
  })
  it('quien dejó de latir hace más de la ventana ya no figura en línea', async () => {
    const h = await session(await mkUser({ email: ROOT }))
    await visit({ sid: sidOf(1), watch: { key: 'movie:1', title: 'A' } })
    clock += ONLINE_WINDOW_MS + 1000
    await visit({ sid: sidOf(2) })
    clock -= 30_000
    const { body } = await call('realtime', h)
    expect(body.online).toBe(1)
    expect(body.watching).toBe(0)
  })
})

describe('dashboard', () => {
  let h
  beforeEach(async () => { h = await session(await mkUser({ email: ROOT })) })

  it('sin datos devuelve todo en cero y bien formado', async () => {
    const { status, body } = await call('dashboard', h)
    expect(status).toBe(200)
    expect(body.totals).toMatchObject({ visitors: 0, plays: 0, watchHours: 0, avgWatchMinutesPerPlay: 0 })
    expect(body.series).toHaveLength(7)
    expect(body.hours).toHaveLength(24)
    expect(body.topByTime).toEqual([])
    expect(body.funnel.conversionPct).toBeNull()
    expect(body.deltas.visitors).toBeNull()
  })
  it('valida el rango: solo 1, 7 o 30 días (si no, 7)', async () => {
    for (const [q, n] of [[1, 1], [7, 7], [30, 30], [999, 7], ['x', 7], [undefined, 7], [-3, 7]]) {
      expect((await call('dashboard', h, { days: q })).body.series).toHaveLength(n)
    }
  })
  it('calcula visitantes, vistas, horas vistas y reproducciones', async () => {
    // 1 mira Matrix 5 min (11 latidos de 30 s = 300 s), 2 mira Breaking Bad 2 min, 3 solo navega
    await visit({ sid: sidOf(1), watch: { key: 'movie:603', title: 'Matrix' }, beats: 11, member: true })
    await visit({ sid: sidOf(2), watch: { key: 'tv:1396', title: 'Breaking Bad' }, beats: 5 })
    await visit({ sid: sidOf(3), beats: 3, country: 'CL', plat: 'pwa' })
    const { body } = await call('dashboard', h, { days: 1 })
    expect(body.totals.visitors).toBe(3)
    expect(body.totals.plays).toBe(2)
    expect(body.totals.watchHours).toBeCloseTo((300 + 120) / 3600, 1)
    expect(body.totals.avgWatchMinutesPerPlay).toBe(3.5)        // 420 s / 2 reproducciones
    expect(body.audience.countries).toEqual([{ label: 'AR', value: 2 }, { label: 'CL', value: 1 }])
    expect(body.audience.platforms.find((p) => p.label === 'pwa').value).toBe(1)
    expect(body.audience).toMatchObject({ members: 1, guests: 2 })
    expect(body.audience.watchHoursMembers).toBeGreaterThan(body.audience.watchHoursGuests)
  })
  it('con poco tráfico, pocos minutos de visualización no se redondean a cero', async () => {
    await visit({ sid: sidOf(1), watch: { key: 'movie:1', title: 'Corta' }, beats: 5 })      // 120 s
    const { body } = await call('dashboard', h, { days: 1 })
    expect(body.totals.watchHours).toBeGreaterThan(0)
    expect(body.totals.watchSeconds).toBe(120)
    expect(body.watchByType.movieHours).toBeGreaterThan(0)
  })
  it('ordena lo más visto por tiempo y por reproducciones, con horas y minutos', async () => {
    await visit({ sid: sidOf(1), watch: { key: 'movie:1', title: 'Larga' }, beats: 21 })       // 600 s
    await visit({ sid: sidOf(2), watch: { key: 'movie:2', title: 'Corta' }, beats: 3 })        // 60 s
    await visit({ sid: sidOf(3), watch: { key: 'movie:2', title: 'Corta' }, beats: 2 })        // 30 s (2 personas)
    const { body } = await call('dashboard', h, { days: 7 })
    expect(body.topByTime.map((x) => x.title)).toEqual(['Larga', 'Corta'])
    expect(body.topByPlays.map((x) => x.title)).toEqual(['Corta', 'Larga'])
    expect(body.topByTime[0]).toMatchObject({ key: 'movie:1', type: 'movie', minutes: 10, plays: 1 })
    expect(body.watchByType.movieHours).toBeGreaterThan(0)
    expect(body.watchByType.tvHours).toBe(0)
  })
  it('compara con el período anterior', async () => {
    // "anterior": ayer 2 visitantes; hoy 3
    clock = T0 - 86400000
    await visit({ sid: sidOf(1) }); await visit({ sid: sidOf(2) })
    clock = T0
    await visit({ sid: sidOf(3) }); await visit({ sid: sidOf(4) }); await visit({ sid: sidOf(5) })
    const { body } = await call('dashboard', h, { days: 1 })
    expect(body.totals.visitors).toBe(3)
    expect(body.deltas.visitors).toBe(50)
  })
  it('arma la serie diaria con la fecha de cada día', async () => {
    clock = T0 - 2 * 86400000
    await visit({ sid: sidOf(1) })
    clock = T0
    await visit({ sid: sidOf(2) }); await visit({ sid: sidOf(3) })
    const { body } = await call('dashboard', h, { days: 7 })
    expect(body.series.at(-1)).toMatchObject({ date: dayKey(T0), visitors: 2 })
    expect(body.series.at(-3)).toMatchObject({ date: dayKey(T0 - 2 * 86400000), visitors: 1 })
    expect(body.series.map((s) => s.date)).toEqual([...body.series.map((s) => s.date)].sort())
  })
  it('horas pico: reparte la actividad por hora argentina', async () => {
    await visit({ sid: sidOf(1), beats: 4 })
    const { body } = await call('dashboard', h, { days: 1 })
    expect(body.hours.find((x) => x.label === '12:00').value).toBeGreaterThan(0)
    expect(body.hours.find((x) => x.label === '03:00').value).toBe(0)
  })
  it('embudo de registro y donaciones', async () => {
    const ev = (name, n = 1) => Promise.all(Array.from({ length: n }, () => pulse({ body: { k: 'ev', sid: sidOf(9), name }, headers: hdr() })))
    await ev('gate_shown_watch', 6); await ev('gate_shown_list', 4); await ev('signup_gate', 2); await ev('signup', 1); await ev('login', 3)
    await ev('donate_shown', 10); await ev('donate_click', 1)
    const { body } = await call('dashboard', h, { days: 1 })
    expect(body.funnel).toMatchObject({
      gateShown: 10, gateShownWatch: 6, gateShownList: 4, signupsFromGate: 2, signupsOther: 1, logins: 3,
      conversionPct: 20, donateShown: 10, donateClicks: 1, donateCtrPct: 10,
    })
    expect(body.totals.signups).toBe(3)
  })
  it('cuentas: totales, Google vs clave, verificados, supporters, nuevos por día y recientes enmascarados', async () => {
    await mkUser({ email: 'ana.garcia@gmail.com', name: 'Ana', googleSub: 'g1', createdAt: T0 - 1000 })
    await mkUser({ email: 'beto@mail.com', passHash: 'x', emailVerified: false, createdAt: T0 - 2 * 86400000, supporterSince: 5 })
    await mkUser({ email: 'viejo@mail.com', passHash: 'x', createdAt: T0 - 90 * 86400000 })
    const { body } = await call('dashboard', h)
    const u = body.users
    expect(u).toMatchObject({ total: 4, google: 1, withPassword: 2, supporters: 1, last24h: 2, last7d: 3 })
    expect(u.newByDay).toHaveLength(30)
    expect(u.newByDay.at(-1).count).toBeGreaterThanOrEqual(1)
    expect(u.recent[0].email).toMatch(/^[^@]{2}\*+@/)
    expect(JSON.stringify(u.recent)).not.toContain('ana.garcia')
    expect(JSON.stringify(u.recent)).not.toContain('passHash')
  })
})

describe('datos de demostración', () => {
  it('por defecto el panel NO está en modo demostración', async () => {
    const h = await session(await mkUser({ email: ROOT }))
    expect((await call('dashboard', h)).body.demo).toBe(false)
    expect((await call('realtime', h)).body.demo).toBe(false)
  })
  it('si el almacenamiento se cargó con datos inventados, la API lo avisa (el panel muestra el cartel rojo)', async () => {
    stats.demo = true
    const h = await session(await mkUser({ email: ROOT }))
    expect((await call('dashboard', h)).body.demo).toBe(true)
    expect((await call('realtime', h)).body.demo).toBe(true)
  })
})

describe('totalsOf', () => {
  it('suma contadores y mapas anidados', () => {
    const t = totalsOf([
      { visitors: 2, views: 5, byCountry: { AR: 2 }, hours: { '12': 3 }, ev: { signup: 1 } },
      { visitors: 3, views: 1, byCountry: { AR: 1, CL: 2 }, hours: { '12': 1, '13': 4 }, ev: { signup_gate: 2 } },
    ])
    expect(t).toMatchObject({ visitors: 5, views: 6, signups: 3 })
    expect(t.byCountry).toEqual({ AR: 3, CL: 2 })
    expect(t.hours).toEqual({ '12': 4, '13': 4 })
  })
  it('tolera documentos vacíos o con basura', () => {
    expect(totalsOf([{}, { visitors: 'x', byCountry: null }]).visitors).toBe(0)
  })
})
