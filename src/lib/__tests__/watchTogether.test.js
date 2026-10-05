import { describe, it, expect } from 'vitest'
import { dayOptions, defaultDay, parseWhen, buildInviteMessage } from '../watchTogether'

describe('dayOptions', () => {
  it('devuelve 7 días empezando por Hoy y Mañana', () => {
    const o = dayOptions('2026-10-05')
    expect(o).toHaveLength(7)
    expect(o[0]).toEqual({ value: '2026-10-05', label: 'Hoy' })
    expect(o[1].label).toBe('Mañana')
    expect(o[6].value).toBe('2026-10-11')
  })
})

describe('defaultDay', () => {
  it('hoy si es temprano, mañana si ya es tarde', () => {
    expect(defaultDay(new Date(2026, 9, 5, 15, 0))).toBe('2026-10-05')
    expect(defaultDay(new Date(2026, 9, 5, 22, 0))).toBe('2026-10-06')
  })
})

describe('parseWhen', () => {
  it('arma la fecha local', () => {
    const d = parseWhen('2026-10-10', '21:30')
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 10, 21, 30])
  })
  it('null si es inválida', () => {
    expect(parseWhen('2026-10-10', '')).toBeNull()
    expect(parseWhen('', '21:00')).toBeNull()
  })
})

describe('buildInviteMessage', () => {
  const url = 'https://lifehigh.site/movie/1'
  it('hoy / mañana / otro día', () => {
    expect(buildInviteMessage({ title: 'Peli', when: new Date(2026, 9, 5, 21, 0), url, today: '2026-10-05' }))
      .toContain('juntos hoy a las 21:00')
    expect(buildInviteMessage({ title: 'Peli', when: new Date(2026, 9, 6, 9, 5), url, today: '2026-10-05' }))
      .toContain('juntos mañana a las 09:05')
    expect(buildInviteMessage({ title: 'Peli', when: new Date(2026, 9, 10, 21, 0), url, today: '2026-10-05' }))
      .toContain('juntos el sábado 10 de octubre a las 21:00')
  })
  it('incluye título y link', () => {
    const msg = buildInviteMessage({ title: 'Peli', when: new Date(2026, 9, 5, 21, 0), url, today: '2026-10-05' })
    expect(msg).toContain('"Peli"')
    expect(msg.endsWith(url)).toBe(true)
  })
})
