import { describe, it, expect } from 'vitest'
import { computeRetention, withSeenDay, SEEN_DAYS_KEEP } from '../_lib/retention.js'
import { dayKey } from '../_lib/pulse.js'

const DAY = 86400000
const NOW = Date.UTC(2026, 9, 20, 15, 0, 0)      // 20/10/2026 12:00 en Argentina
const ago = (d) => NOW - d * DAY
const key = (d) => dayKey(ago(d))

describe('withSeenDay', () => {
  it('agrega el día una vez y no repite escrituras', () => {
    expect(withSeenDay({}, '2026-10-20')).toEqual({ lastSeenDay: '2026-10-20', seenDays: ['2026-10-20'] })
    expect(withSeenDay({ lastSeenDay: '2026-10-20', seenDays: ['2026-10-20'] }, '2026-10-20')).toBeNull()
    expect(withSeenDay({ lastSeenDay: '2026-10-19', seenDays: ['2026-10-19'] }, '2026-10-20').seenDays).toEqual(['2026-10-19', '2026-10-20'])
  })
  it('acota la lista a los últimos días', () => {
    const many = Array.from({ length: SEEN_DAYS_KEEP + 30 }, (_, i) => `2026-${String(1 + Math.floor(i / 28)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`)
    const out = withSeenDay({ lastSeenDay: '2000-01-01', seenDays: many }, '2026-12-31')
    expect(out.seenDays.length).toBe(SEEN_DAYS_KEEP)
    expect(out.seenDays.at(-1)).toBe('2026-12-31')
  })
})

describe('computeRetention', () => {
  it('sin usuarios no inventa porcentajes', () => {
    const r = computeRetention([], NOW)
    expect(r.activity).toEqual({ dau: 0, wau: 0, mau: 0, stickiness: null })
    expect(r.returned.every((x) => x.pct === null && x.eligible === 0)).toBe(true)
    expect(r.cohorts).toEqual([])
  })

  it('cuenta activos de hoy, 7 y 30 días y la "pegajosidad"', () => {
    const users = [
      { createdAt: ago(40), seenDays: [key(0)] },                 // hoy
      { createdAt: ago(40), seenDays: [key(3)] },                 // esta semana
      { createdAt: ago(40), seenDays: [key(20)] },                // este mes
      { createdAt: ago(40), seenDays: [key(45)] },                // inactivo
    ]
    const r = computeRetention(users, NOW)
    expect(r.activity).toMatchObject({ dau: 1, wau: 2, mau: 3 })
    expect(r.activity.stickiness).toBe(33.3)
  })

  it('"volvió" excluye el mismo día del registro y solo evalúa a quien ya pasó el plazo', () => {
    const users = [
      { createdAt: ago(10), seenDays: [key(10), key(9)] },        // volvió al día siguiente
      { createdAt: ago(10), seenDays: [key(10)] },                // solo el día del registro: NO volvió
      { createdAt: ago(10), seenDays: [key(10), key(5)] },        // volvió dentro de 7 días, no al día 1
      { createdAt: ago(0), seenDays: [key(0)] },                  // se registró hoy: todavía no evaluable
    ]
    const r = computeRetention(users, NOW)
    const by = Object.fromEntries(r.returned.map((x) => [x.days, x]))
    expect(by[1]).toMatchObject({ eligible: 3, returned: 1, pct: 33.3 })
    expect(by[7]).toMatchObject({ eligible: 3, returned: 2, pct: 66.7 })
    expect(by[30]).toMatchObject({ eligible: 0, returned: 0, pct: null })     // ninguno tiene 30 días todavía
  })

  it('arma cohortes semanales (lunes), de la más nueva a la más vieja', () => {
    const users = [
      { createdAt: Date.UTC(2026, 9, 5, 15), seenDays: ['2026-10-05', '2026-10-06'] },    // lun 5/10
      { createdAt: Date.UTC(2026, 9, 7, 15), seenDays: ['2026-10-07'] },                   // mié 7/10
      { createdAt: Date.UTC(2026, 9, 14, 15), seenDays: ['2026-10-14'] },                  // mié 14/10
    ]
    const r = computeRetention(users, NOW)
    expect(r.cohorts.map((c) => [c.week, c.size])).toEqual([['2026-10-12', 1], ['2026-10-05', 2]])
    const first = r.cohorts[1]
    expect(first.d1).toEqual({ eligible: 2, pct: 50 })
    expect(first.d30.pct).toBeNull()
  })
})
