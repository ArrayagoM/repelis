import { describe, it, expect } from 'vitest'
import { reminderActions } from '../reminders'
import { buildIcs } from '../ics'

const r = (over) => ({ id: 1, type: 'movie', title: 'X', date: '2026-10-10', notified: false, ...over })

describe('reminderActions', () => {
  it('avisa lo que ya se estrenó, una sola vez', () => {
    expect(reminderActions([r({ date: '2026-10-05' })], '2026-10-05').released).toHaveLength(1)
    expect(reminderActions([r({ date: '2026-10-01' })], '2026-10-05').released).toHaveLength(1)
    expect(reminderActions([r({ date: '2026-10-01', notified: true })], '2026-10-05').released).toHaveLength(0)
  })
  it('avisa "mañana se estrena" una sola vez', () => {
    expect(reminderActions([r({ date: '2026-10-06' })], '2026-10-05').soon).toHaveLength(1)
    expect(reminderActions([r({ date: '2026-10-06', notifiedSoon: true })], '2026-10-05').soon).toHaveLength(0)
  })
  it('no avisa lo lejano ni lo que no tiene fecha', () => {
    const out = reminderActions([r({ date: '2026-11-20' }), r({ id: 2, date: null })], '2026-10-05')
    expect(out).toEqual({ released: [], soon: [] })
  })
  it('cruza fin de mes y de año para "mañana"', () => {
    expect(reminderActions([r({ date: '2027-01-01' })], '2026-12-31').soon).toHaveLength(1)
  })
})

describe('buildIcs', () => {
  const ics = buildIcs({ uid: 'movie-1', title: 'Estreno: Peli, la secuela; parte 2', date: '2026-12-25', url: 'https://x.test/movie/1' })

  it('arma un evento de día completo con alarma', () => {
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261225')
    expect(ics).toContain('DTEND;VALUE=DATE:20261226')
    expect(ics).toContain('BEGIN:VALARM')
    expect(ics.endsWith('\r\n')).toBe(true)
  })
  it('escapa comas y punto y coma', () => {
    expect(ics).toContain('SUMMARY:Estreno: Peli\\, la secuela\\; parte 2')
  })
  it('ninguna línea supera 75 octetos', () => {
    const long = buildIcs({ uid: 'a', title: 'T'.repeat(200), date: '2026-01-01' })
    for (const line of long.split('\r\n')) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75)
  })
  it('evento con horario usa hora local sin Z', () => {
    const t = buildIcs({ uid: 'b', title: 'Juntos', start: new Date(2026, 9, 10, 21, 0) })
    expect(t).toContain('DTSTART:20261010T210000')
    expect(t).toContain('DTEND:20261010T230000')
  })
})
