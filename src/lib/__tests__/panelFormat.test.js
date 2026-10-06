import { describe, it, expect } from 'vitest'
import { fmtInt, fmtHours, fmtMinutes, fmtDelta, flagEmoji, countryName, ago, shortDay } from '../panelFormat'

describe('formatos del panel', () => {
  it('fmtInt agrupa miles con el formato argentino y tolera basura', () => {
    expect(fmtInt(1234)).toBe('1.234')
    expect(fmtInt(0)).toBe('0')
    expect(fmtInt(undefined)).toBe('0')
    expect(fmtInt('x')).toBe('0')
    expect(fmtInt(1234.6)).toBe('1.235')
  })
  it('fmtHours: minutos si es menos de una hora, horas con coma decimal si no', () => {
    expect(fmtHours(0)).toBe('0 min')
    expect(fmtHours(0.5)).toBe('30 min')
    expect(fmtHours(0.001)).toBe('1 min')
    expect(fmtHours(12.5)).toBe('12,5 h')
    expect(fmtHours(100)).toBe('100 h')
    expect(fmtHours(null)).toBe('0 min')
  })
  it('fmtMinutes', () => {
    expect(fmtMinutes(0)).toBe('0 min')
    expect(fmtMinutes(3.5)).toBe('3,5 min')
    expect(fmtMinutes(80)).toBe('1 h 20 min')
    expect(fmtMinutes(undefined)).toBe('0 min')
  })
  it('fmtDelta distingue sube, baja, igual y sin datos', () => {
    expect(fmtDelta(50)).toEqual({ text: '▲ 50%', tone: 'up' })
    expect(fmtDelta(-20)).toEqual({ text: '▼ 20%', tone: 'down' })
    expect(fmtDelta(0).tone).toBe('flat')
    expect(fmtDelta(null).text).toBe('sin datos previos')
    expect(fmtDelta(undefined).tone).toBe('flat')
    expect(fmtDelta(NaN).tone).toBe('flat')
  })
  it('banderas y nombres de países en español', () => {
    expect(flagEmoji('AR')).toBe('🇦🇷')
    expect(flagEmoji('XX')).toBe('🇽🇽')
    expect(flagEmoji('')).toBe('🌐')
    expect(flagEmoji('a.b')).toBe('🌐')
    expect(countryName('AR')).toBe('Argentina')
    expect(countryName('MX')).toBe('México')
    expect(countryName(undefined)).toBe('Desconocido')
  })
  it('ago y shortDay', () => {
    const now = 1_000_000_000_000
    expect(ago(now - 3000, now)).toBe('recién')
    expect(ago(now - 30_000, now)).toBe('hace 30 s')
    expect(ago(now - 5 * 60_000, now)).toBe('hace 5 min')
    expect(ago(now - 3 * 3600_000, now)).toBe('hace 3 h')
    expect(ago(now - 2 * 86400_000, now)).toBe('hace 2 d')
    expect(shortDay('2026-10-06')).toBe('6/10')
  })
})
