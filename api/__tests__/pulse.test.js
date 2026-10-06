import { describe, it, expect, beforeEach } from 'vitest'
import { createPulse, dayKey, hourKey, ONLINE_WINDOW_MS } from '../_lib/pulse.js'
import { createMemoryStats } from '../_lib/statsStore.js'

const SID = 'a1b2c3d4e5f6g7h8i9j0'
const T0 = Date.UTC(2026, 9, 6, 15, 0, 0)            // 12:00 en Argentina
const MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
const hdr = { 'x-vercel-ip-country': 'AR', 'x-vercel-ip-city': 'Rosario', 'user-agent': MOBILE }

let stats, clock, pulse
beforeEach(() => {
  stats = createMemoryStats()
  clock = T0
  pulse = createPulse({ stats, now: () => clock })
})

const hb = (over = {}, headers = hdr) => pulse({ body: { k: 'hb', sid: SID, page: 'home', plat: 'web', member: false, ...over }, headers })
const day = () => dayKey(clock)
const g = (path) => stats._get(day(), path)
const advance = (sec) => { clock += sec * 1000 }
const watch = (key = 'movie:603', title = 'Matrix') => ({ w: { key, title } })

describe('zona horaria', () => {
  it('el día y la hora se calculan en hora de Argentina (UTC-3)', () => {
    const t = Date.UTC(2026, 9, 6, 2, 30)            // 02:30 UTC = 23:30 del día anterior en AR
    expect(dayKey(t)).toBe('2026-10-05')
    expect(hourKey(t)).toBe('23')
    expect(dayKey(Date.UTC(2026, 9, 6, 3, 0))).toBe('2026-10-06')
  })
})

describe('validación', () => {
  it('rechaza cuerpos y ids inválidos', async () => {
    for (const body of [null, undefined, 'x', 5, {}, { k: 'hb' }, { k: 'hb', sid: 'corto' }, { k: 'hb', sid: 'x'.repeat(60) }, { k: 'hb', sid: 'con espacios y simbolos!!' }, { k: 'zzz', sid: SID }]) {
      expect((await pulse({ body, headers: hdr })).status).toBe(400)
    }
    expect(stats._dump().presence.size).toBe(0)
  })
  it('solo acepta eventos de la lista', async () => {
    expect((await pulse({ body: { k: 'ev', sid: SID, name: 'signup' }, headers: hdr })).status).toBe(200)
    expect((await pulse({ body: { k: 'ev', sid: SID, name: 'drop.table' }, headers: hdr })).status).toBe(400)
    expect((await pulse({ body: { k: 'ev', sid: SID, name: '__proto__' }, headers: hdr })).status).toBe(400)
  })
  it('valores fuera de la lista caen a un valor seguro (sin claves con punto)', async () => {
    await hb({ plat: 'a.b', page: 'x.y' }, { ...hdr, 'x-vercel-ip-country': 'A.B' })
    expect(g('byPlat.web')).toBe(1)
    expect(g('pages.other')).toBe(1)
    expect(g('byCountry.XX')).toBe(1)
    const keys = Object.keys(stats._dump().daily.get(day()))
    expect(keys.every((k) => !k.includes('.'))).toBe(true)
  })
})

describe('primer latido del día', () => {
  it('cuenta visitante, vista, país, dispositivo, plataforma y hora', async () => {
    await hb({ member: true, plat: 'pwa' })
    expect(g('visitors')).toBe(1)
    expect(g('views')).toBe(1)
    expect(g('pages.home')).toBe(1)
    expect(g('byCountry.AR')).toBe(1)
    expect(g('byDevice.mobile')).toBe(1)
    expect(g('byPlat.pwa')).toBe(1)
    expect(g('members')).toBe(1)
    expect(g('guests')).toBeUndefined()
    expect(g('hours.12')).toBe(1)
  })
  it('no guarda datos personales en la presencia', async () => {
    await hb({}, { ...hdr, 'x-forwarded-for': '1.2.3.4', cookie: 'lh_session=secreto' })
    const p = stats._dump().presence.get(SID)
    const text = JSON.stringify(p)
    expect(text).not.toContain('1.2.3.4')
    expect(text).not.toContain('secreto')
    expect(p).toMatchObject({ country: 'AR', city: 'Rosario', device: 'mobile', member: false })
  })
  it('un mismo visitante no se cuenta dos veces el mismo día', async () => {
    await hb()
    advance(60); await hb()
    advance(60); await hb()
    expect(g('visitors')).toBe(1)
  })
  it('al día siguiente vuelve a contar como visitante', async () => {
    await hb()
    clock += 24 * 3600 * 1000
    await hb()
    expect(stats._get(dayKey(T0), 'visitors')).toBe(1)
    expect(stats._get(dayKey(clock), 'visitors')).toBe(1)
  })
})

describe('tiempo en el sitio y vistas', () => {
  it('suma el tiempo entre latidos consecutivos', async () => {
    await hb()
    advance(45); await hb()
    advance(45); await hb()
    expect(g('activeSeconds')).toBe(90)
  })
  it('un corte largo no inventa minutos', async () => {
    await hb()
    advance(600); await hb()
    expect(g('activeSeconds')).toBeUndefined()
  })
  it('el tiempo entre dos latidos se cuenta hasta el tope (150 s)', async () => {
    await hb()
    advance(150); await hb()
    expect(g('activeSeconds')).toBe(150)
  })
  it('si pasó más del tope, se considera un corte y no suma', async () => {
    await hb()
    advance(151); await hb()
    expect(g('activeSeconds')).toBeUndefined()
  })
  it('latidos demasiado seguidos no suman nada (anti-spam)', async () => {
    await hb()
    for (let i = 0; i < 20; i++) { advance(1); await hb({ nav: true }) }
    expect(g('views')).toBe(1)
    expect(g('hours.12')).toBe(1)
  })
  it('cuenta una vista nueva cuando cambia de página (nav)', async () => {
    await hb()
    advance(20); await hb({ page: 'movie', nav: true })
    advance(20); await hb({ page: 'movie' })            // latido normal: no es otra vista
    expect(g('views')).toBe(2)
    expect(g('pages.movie')).toBe(1)
  })
})

describe('tiempo de visualización', () => {
  it('el primer latido viendo un título cuenta una reproducción (sin segundos todavía)', async () => {
    await hb(watch())
    expect(g('plays')).toBe(1)
    expect(g('watchSeconds')).toBeUndefined()
  })
  it('los latidos siguientes del mismo título suman segundos (tiempo calculado por el servidor)', async () => {
    await hb(watch())
    advance(30); await hb(watch())
    advance(30); await hb(watch())
    expect(g('plays')).toBe(1)
    expect(g('watchSeconds')).toBe(60)
    expect(g('watch.guest')).toBe(60)
    const title = stats._dump().titles.get(`${day()}|movie:603`)
    expect(title).toMatchObject({ title: 'Matrix', type: 'movie', plays: 1, seconds: 60 })
  })
  it('separa tiempo de miembros y de invitados', async () => {
    await hb({ ...watch(), member: true })
    advance(30); await hb({ ...watch(), member: true })
    expect(g('watch.member')).toBe(30)
    expect(g('watch.guest')).toBeUndefined()
  })
  it('cambiar de título cuenta otra reproducción', async () => {
    await hb(watch('movie:603', 'Matrix'))
    advance(30); await hb(watch('tv:1396', 'Breaking Bad'))
    expect(g('plays')).toBe(2)
    expect(g('watchSeconds')).toBeUndefined()           // el cambio de título no hereda segundos
    advance(30); await hb(watch('tv:1396', 'Breaking Bad'))
    expect(stats._dump().titles.get(`${day()}|tv:1396`)).toMatchObject({ type: 'tv', seconds: 30, plays: 1 })
  })
  it('pasar de navegar a mirar es una reproducción nueva; y si deja de mirar, ya no suma', async () => {
    await hb()
    advance(30); await hb(watch())
    advance(30); await hb()                             // dejó de ver
    advance(30); await hb(watch())                      // vuelve: otra reproducción
    expect(g('plays')).toBe(2)
    expect(g('watchSeconds')).toBeUndefined()
  })
  it('un corte largo mirando no regala horas', async () => {
    await hb(watch())
    advance(3600); await hb(watch())
    expect(g('watchSeconds')).toBeUndefined()
    expect(g('plays')).toBe(2)
  })
  it('claves y títulos inválidos no cuentan como visualización y se limpian', async () => {
    await hb({ w: { key: 'movie:abc', title: 'x' } })
    await hb({ w: { key: 'drop:1', title: 'x' } }, hdr)
    expect(g('plays')).toBeUndefined()
    advance(30); await hb({ w: { key: 'movie:5', title: '<script>alert(1)</script>' + 'x'.repeat(300) } })
    const t = stats._dump().titles.get(`${day()}|movie:5`)
    expect(t.title).not.toMatch(/[<>]/)
    expect(t.title.length).toBeLessThanOrEqual(120)
  })
})

describe('eventos', () => {
  it('suman al contador del día', async () => {
    for (const name of ['gate_shown_watch', 'gate_shown_watch', 'signup_gate', 'donate_shown']) {
      await pulse({ body: { k: 'ev', sid: SID, name }, headers: hdr })
    }
    expect(g('ev.gate_shown_watch')).toBe(2)
    expect(g('ev.signup_gate')).toBe(1)
    expect(g('ev.donate_shown')).toBe(1)
  })
})

describe('en línea ahora', () => {
  it('listOnline devuelve solo a quienes latieron en la ventana', async () => {
    await hb()
    await pulse({ body: { k: 'hb', sid: 'zzzzzzzzzzzzzzzzzzzz', page: 'home' }, headers: hdr })
    advance(ONLINE_WINDOW_MS / 1000 + 5)
    await pulse({ body: { k: 'hb', sid: 'yyyyyyyyyyyyyyyyyyyy', page: 'home' }, headers: hdr })
    const online = await stats.listOnline(clock - ONLINE_WINDOW_MS)
    expect(online.map((p) => p._id)).toEqual(['yyyyyyyyyyyyyyyyyyyy'])
  })
})
