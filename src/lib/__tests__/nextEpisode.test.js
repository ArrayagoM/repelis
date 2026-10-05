import { describe, it, expect } from 'vitest'
import { nextTarget, shouldOfferNext, getAutoNext, setAutoNext } from '../nextEpisode'

describe('nextTarget', () => {
  it('avanza dentro de la temporada', () => {
    expect(nextTarget({ season: 1, episode: 3, episodeCount: 10, totalSeasons: 2 })).toEqual({ season: 1, episode: 4 })
  })
  it('salta a la temporada siguiente al terminar la actual', () => {
    expect(nextTarget({ season: 1, episode: 10, episodeCount: 10, totalSeasons: 2 })).toEqual({ season: 2, episode: 1 })
  })
  it('null en el último episodio de la última temporada', () => {
    expect(nextTarget({ season: 2, episode: 8, episodeCount: 8, totalSeasons: 2 })).toBeNull()
  })
  it('si no conoce la cantidad de episodios asume que hay uno más', () => {
    expect(nextTarget({ season: 1, episode: 5, episodeCount: 0, totalSeasons: 1 })).toEqual({ season: 1, episode: 6 })
  })
})

describe('shouldOfferNext', () => {
  const base = { isTV: true, hasNext: true, runtimeMin: 40 }
  it('solo cerca del final del episodio', () => {
    expect(shouldOfferNext({ ...base, watchedSec: 40 * 60 * 0.5 })).toBe(false)
    expect(shouldOfferNext({ ...base, watchedSec: 40 * 60 * 0.95 })).toBe(true)
  })
  it('nunca en películas ni sin siguiente', () => {
    expect(shouldOfferNext({ ...base, isTV: false, watchedSec: 99999 })).toBe(false)
    expect(shouldOfferNext({ ...base, hasNext: false, watchedSec: 99999 })).toBe(false)
  })
})

describe('autoplay', () => {
  it('por defecto está activo y se puede apagar', () => {
    expect(getAutoNext()).toBe(true)
    setAutoNext(false)
    expect(getAutoNext()).toBe(false)
    setAutoNext(true)
    expect(getAutoNext()).toBe(true)
  })
})
