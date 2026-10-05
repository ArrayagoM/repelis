import { describe, it, expect } from 'vitest'
import { dayLabel, groupByDate } from '../calendar'

describe('dayLabel', () => {
  it('Hoy y Mañana', () => {
    expect(dayLabel('2026-10-05', '2026-10-05')).toBe('Hoy')
    expect(dayLabel('2026-10-06', '2026-10-05')).toBe('Mañana')
  })
  it('día de la semana en español', () => {
    expect(dayLabel('2026-10-09', '2026-10-05')).toBe('Viernes 9 de octubre')
  })
  it('mañana cruza fin de año', () => {
    expect(dayLabel('2027-01-01', '2026-12-31')).toBe('Mañana')
  })
})

describe('groupByDate', () => {
  const a = (id, date) => ({ id, date })
  it('agrupa por fecha y ordena ascendente', () => {
    const out = groupByDate([a(1, '2026-10-20'), a(2, '2026-10-06'), a(3, '2026-10-20')], '2026-10-05')
    expect(out.map((g) => g.date)).toEqual(['2026-10-06', '2026-10-20'])
    expect(out[1].items.map((x) => x.id)).toEqual([1, 3])
  })
  it('descarta fechas pasadas o sin fecha', () => {
    expect(groupByDate([a(1, '2026-10-01'), a(2, null)], '2026-10-05')).toEqual([])
  })
})
