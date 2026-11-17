import { describe, it, expect } from 'vitest'
import { isHalloweenSeason, daysToHalloween, halloweenCountdown, isChristmasSeason, daysToChristmas, christmasCountdown } from '../seasons'

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

describe('temporada de Navidad', () => {
  it('va del 15 de noviembre al 6 de enero', () => {
    expect(isChristmasSeason(d(2026, 11, 14))).toBe(false)
    expect(isChristmasSeason(d(2026, 11, 15))).toBe(true)
    expect(isChristmasSeason(d(2026, 12, 25))).toBe(true)
    expect(isChristmasSeason(d(2027, 1, 6))).toBe(true)
    expect(isChristmasSeason(d(2027, 1, 7))).toBe(false)
    expect(isChristmasSeason(d(2026, 10, 31))).toBe(false)
    expect(isChristmasSeason(d(2026, 7, 1))).toBe(false)
  })
  it('no se pisa con la de Halloween', () => {
    for (let m = 1; m <= 12; m += 1) {
      for (let day = 1; day <= 28; day += 1) expect(isChristmasSeason(d(2026, m, day)) && isHalloweenSeason(d(2026, m, day))).toBe(false)
    }
  })
  it('cuenta los días hasta el 25 de diciembre', () => {
    expect(daysToChristmas(d(2026, 11, 17))).toBe(38)
    expect(daysToChristmas(d(2026, 12, 25))).toBe(0)
    expect(daysToChristmas(d(2026, 12, 26))).toBe(-1)
    expect(daysToChristmas(d(2027, 1, 3))).toBe(-9)
  })
  it('el cartel del contador se adapta', () => {
    expect(christmasCountdown(d(2026, 11, 17))).toBe('Faltan 38 días para Navidad')
    expect(christmasCountdown(d(2026, 12, 24))).toBe('Mañana es Navidad')
    expect(christmasCountdown(d(2026, 12, 25))).toBe('Hoy es Navidad')
    expect(christmasCountdown(d(2026, 12, 30))).toBe('Felices fiestas')
  })
})
