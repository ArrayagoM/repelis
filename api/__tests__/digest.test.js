import { describe, it, expect, beforeEach } from 'vitest'
import { runDigest } from '../_lib/digest.js'
import { createMemoryStore } from '../_lib/stores.js'
import { createMemorySocial } from '../_lib/socialStore.js'

const T = Date.UTC(2026, 9, 20, 16, 0, 0)
let store, social, mails, mailer

beforeEach(() => {
  store = createMemoryStore(); social = createMemorySocial(); mails = []
  mailer = { sendActivity: async (to, o) => { mails.push({ to, ...o }) } }
})

const mk = (email, extra = {}) => store.createUser({ email, name: 'Ana Perez', emailVerified: true, createdAt: T, library: {}, notifyPrefs: { email: true }, ...extra })
const note = (userId, text, at = T - 3600_000) => social.addNotification({ userId, type: 'follow', key: `k${Math.random()}`, text, link: '/u/bea', createdAt: at })

describe('resumen diario por mail', () => {
  it('manda un mail con las novedades sin leer a quien lo activó', async () => {
    const u = await mk('ana@mail.com')
    await note(u.id, '@bea empezó a seguirte'); await note(u.id, 'A @cami le gustó tu lista «X»')
    const r = await runDigest({ store, social, mailer, now: () => T })
    expect(r).toEqual({ checked: 1, sent: 1, failed: 0 })
    expect(mails[0]).toMatchObject({ to: 'ana@mail.com', name: 'Ana Perez', headline: 'Tenés 2 novedades en Life High' })
    expect(mails[0].items[0].link).toBe('https://lifehigh.site/u/bea')
    expect(mails[0].unsubscribeLink).toBe('https://lifehigh.site/avisos')
  })
  it('no manda nada sin novedades, con avisos viejos o ya leídos', async () => {
    const u = await mk('ana@mail.com')
    expect((await runDigest({ store, social, mailer, now: () => T })).sent).toBe(0)
    await note(u.id, 'viejo', T - 3 * 86400_000)
    await social.markRead(u.id, T - 1000)
    await note(u.id, 'leído antes', T - 7200_000); await social.markRead(u.id, T - 3600_000)
    expect((await runDigest({ store, social, mailer, now: () => T })).sent).toBe(0)
  })
  it('no repite: el segundo día solo lo nuevo', async () => {
    const u = await mk('ana@mail.com')
    await note(u.id, 'uno', T - 3600_000)
    await runDigest({ store, social, mailer, now: () => T })
    expect((await runDigest({ store, social, mailer, now: () => T + 3600_000 })).sent).toBe(0)
    await note(u.id, 'dos', T + 7200_000)
    expect((await runDigest({ store, social, mailer, now: () => T + 86400_000 })).sent).toBe(1)
    expect(mails).toHaveLength(2)
  })
  it('respeta la preferencia, el mail sin confirmar y que no haya servicio de mail', async () => {
    const off = await mk('off@mail.com', { notifyPrefs: { email: false } })
    const unverified = await mk('nv@mail.com', { emailVerified: false })
    await note(off.id, 'x'); await note(unverified.id, 'x')
    expect((await runDigest({ store, social, mailer, now: () => T })).sent).toBe(0)
    expect(await runDigest({ store, social, mailer: null, now: () => T })).toEqual({ checked: 0, sent: 0, failed: 0 })
  })
  it('un fallo de mail no frena a los demás ni marca como enviado', async () => {
    const a = await mk('a@mail.com'), b = await mk('b@mail.com')
    await note(a.id, 'x'); await note(b.id, 'y')
    mailer = { sendActivity: async (to) => { if (to === 'a@mail.com') throw new Error('boom'); mails.push({ to }) } }
    expect(await runDigest({ store, social, mailer, now: () => T })).toEqual({ checked: 2, sent: 1, failed: 1 })
    expect((await store.findUserById(a.id)).lastDigestAt).toBeUndefined()
  })
})

describe('limpieza', () => {
  it('borra los avisos de más de 60 días al correr', async () => {
    const u = await mk('ana@mail.com')
    await note(u.id, 'viejísimo', T - 90 * 86400_000); await note(u.id, 'reciente', T - 1000)
    await runDigest({ store, social, mailer: null, now: () => T })
    expect((await social.listNotifications(u.id)).map((n) => n.text)).toEqual(['reciente'])
  })
})
