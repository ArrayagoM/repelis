import { describe, it, expect } from 'vitest'
import { pickSeeds, mergeRecommendations } from '../forYou'

const m = (id, over = {}) => ({ id, title: `T${id}`, release_date: '2020-01-01', popularity: 10, ...over })

describe('pickSeeds', () => {
  it('prioriza lo último visto y completa con la lista, sin repetir', () => {
    const lib = {
      history: [{ id: 1, type: 'movie', updatedAt: 1 }, { id: 2, type: 'tv', updatedAt: 5 }],
      list: [{ id: 1, type: 'movie' }, { id: 3, type: 'movie' }],
    }
    expect(pickSeeds(lib).map((s) => s.id)).toEqual([2, 1, 3])
  })
  it('respeta el máximo', () => {
    const lib = { history: [], list: Array.from({ length: 9 }, (_, i) => ({ id: i, type: 'movie' })) }
    expect(pickSeeds(lib, 4)).toHaveLength(4)
  })
})

describe('mergeRecommendations', () => {
  it('sube lo que recomiendan varias semillas', () => {
    const out = mergeRecommendations([
      { type: 'movie', results: [m(1, { popularity: 99 }), m(2)] },
      { type: 'movie', results: [m(2), m(3)] },
    ])
    expect(out.map((x) => x.id)).toEqual([2, 1, 3])
  })
  it('excluye lo ya visto/guardado', () => {
    const out = mergeRecommendations([{ type: 'movie', results: [m(1), m(2)] }], new Set(['movie:1']))
    expect(out.map((x) => x.id)).toEqual([2])
  })
  it('excluye estrenos futuros y títulos sin fecha', () => {
    const out = mergeRecommendations([{ type: 'movie', results: [m(1, { release_date: '2999-01-01' }), m(2, { release_date: null }), m(3)] }])
    expect(out.map((x) => x.id)).toEqual([3])
  })
  it('no mezcla película y serie con el mismo id', () => {
    const out = mergeRecommendations([{ type: 'movie', results: [m(7)] }, { type: 'tv', results: [{ id: 7, name: 'S', first_air_date: '2020-01-01' }] }])
    expect(out).toHaveLength(2)
  })
  it('respeta el límite', () => {
    const many = Array.from({ length: 50 }, (_, i) => m(i + 1))
    expect(mergeRecommendations([{ type: 'movie', results: many }], new Set(), 20)).toHaveLength(20)
  })
})
