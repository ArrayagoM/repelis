import { describe, it, expect } from 'vitest'
import { getReleaseStatus, isUpcoming, isReleased, daysUntilRelease } from '../releaseStatus'

const daysFromNow = (n) => {
  const d = new Date(Date.now() + n * 86400000)
  return d.toISOString().slice(0, 10)
}

describe('releaseStatus', () => {
  it('película pasada = released', () => {
    expect(getReleaseStatus({ release_date: '2010-07-16' })).toBe('released')
    expect(isReleased({ release_date: '2010-07-16' })).toBe(true)
    expect(isUpcoming({ release_date: '2010-07-16' })).toBe(false)
  })

  it('película futura = upcoming', () => {
    const future = daysFromNow(30)
    expect(getReleaseStatus({ release_date: future })).toBe('upcoming')
    expect(isUpcoming({ release_date: future })).toBe(true)
    expect(isReleased({ release_date: future })).toBe(false)
  })

  it('sin fecha = unknown (tratado como released)', () => {
    expect(getReleaseStatus({})).toBe('unknown')
    expect(isReleased({})).toBe(true)
    expect(isUpcoming({})).toBe(false)
  })

  it('usa first_air_date para series', () => {
    expect(getReleaseStatus({ first_air_date: '2008-01-20' })).toBe('released')
  })

  it('estreno hoy = released (margen 1 día)', () => {
    expect(getReleaseStatus({ release_date: daysFromNow(0) })).toBe('released')
  })

  it('daysUntilRelease cuenta días para futuras', () => {
    const d = daysUntilRelease({ release_date: daysFromNow(10) })
    expect(d).toBeGreaterThanOrEqual(9)
    expect(d).toBeLessThanOrEqual(11)
  })

  it('daysUntilRelease null para ya estrenadas', () => {
    expect(daysUntilRelease({ release_date: '2010-01-01' })).toBe(null)
  })
})
