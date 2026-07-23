import { describe, it, expect } from 'vitest'
import { getMatchStatus, getLiveFromFixture } from '../sports'

const iso = (offsetMs) => new Date(Date.now() + offsetMs).toISOString().slice(0, 19)

describe('getMatchStatus', () => {
  it('FT status = finished', () => {
    expect(getMatchStatus({ strStatus: 'FT', strTimestamp: iso(-3 * 3600000) })).toBe('finished')
  })

  it('kickoff futuro = upcoming', () => {
    expect(getMatchStatus({ strTimestamp: iso(2 * 3600000) })).toBe('upcoming')
  })

  it('kickoff hace 1h y sin FT = live', () => {
    expect(getMatchStatus({ strTimestamp: iso(-1 * 3600000) })).toBe('live')
  })

  it('kickoff hace 3h sin status = finished (pasó la duración)', () => {
    expect(getMatchStatus({ strTimestamp: iso(-3 * 3600000) })).toBe('finished')
  })

  it('sin timestamp = upcoming', () => {
    expect(getMatchStatus({})).toBe('upcoming')
  })

  it('arma timestamp desde dateEvent + strTime', () => {
    const future = new Date(Date.now() + 4 * 3600000)
    const dateEvent = future.toISOString().slice(0, 10)
    const strTime = future.toISOString().slice(11, 19)
    expect(getMatchStatus({ dateEvent, strTime })).toBe('upcoming')
  })
})

describe('getLiveFromFixture', () => {
  it('filtra solo los que están en vivo', () => {
    const fixture = [
      { idEvent: '1', strStatus: 'FT', strTimestamp: iso(-3 * 3600000) },
      { idEvent: '2', strTimestamp: iso(-1 * 3600000) },  // live
      { idEvent: '3', strTimestamp: iso(3 * 3600000) },   // upcoming
    ]
    const live = getLiveFromFixture(fixture)
    expect(live).toHaveLength(1)
    expect(live[0].idEvent).toBe('2')
  })

  it('lista vacía = vacío', () => {
    expect(getLiveFromFixture([])).toEqual([])
  })
})
