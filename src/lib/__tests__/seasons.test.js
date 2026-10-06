import { describe, it, expect } from 'vitest'
import { isHalloweenSeason, daysToHalloween, halloweenCountdown } from '../seasons'

const d = (y, m, day) => new Date(y, m - 1, day, 12)

describe('temporada de Halloween', () => {
  it('va del 25 de septiembre al 2 de noviembre', () => {
    expect(isHalloweenSeason(d(2026, 9, 24))).toBe(false)
    expect(isHalloweenSeason(d(2026, 9, 25))).toBe(true)
    expect(isHalloweenSeason(d(2026, 10, 6))).toBe(true)
    expect(isHalloweenSeason(d(2026, 10, 31))).toBe(true)
    expect(isHalloweenSeason(d(2026, 11, 2))).toBe(true)
    expect(isHalloweenSeason(d(2026, 11, 3))).toBe(false)
    expect(isHalloweenSeason(d(2026, 7, 1))).toBe(false)
  })
  it('cuenta los días hasta el 31 de octubre', () => {
    expect(daysToHalloween(d(2026, 10, 6))).toBe(25)
    expect(daysToHalloween(d(2026, 10, 31))).toBe(0)
    expect(daysToHalloween(d(2026, 11, 1))).toBe(-1)
  })
  it('el cartel del contador se adapta', () => {
    expect(halloweenCountdown(d(2026, 10, 6))).toBe('Faltan 25 días para Halloween')
    expect(halloweenCountdown(d(2026, 10, 30))).toBe('Mañana es Halloween')
    expect(halloweenCountdown(d(2026, 10, 31))).toBe('Hoy es Halloween')
    expect(halloweenCountdown(d(2026, 11, 2))).toMatch(/ya pasó/)
  })
})
