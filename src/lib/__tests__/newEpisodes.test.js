import { describe, it, expect } from 'vitest'
import { classifyShow, followedShows } from '../newEpisodes'

const ep = (date, season = 2, episode = 5) => ({ date, season, episode, name: 'x' })

describe('classifyShow', () => {
  const today = '2026-10-05'
  it('"nuevo" si salió en los últimos 7 días', () => {
    expect(classifyShow({ last: ep('2026-10-05'), next: null }, today)).toMatchObject({ kind: 'new', daysAgo: 0 })
    expect(classifyShow({ last: ep('2026-09-29'), next: null }, today)).toMatchObject({ kind: 'new', daysAgo: 6 })
  })
  it('un episodio viejo no cuenta', () => {
    expect(classifyShow({ last: ep('2026-09-01'), next: null }, today)).toBeNull()
  })
  it('"pronto" si el próximo sale en 14 días o menos', () => {
    expect(classifyShow({ last: ep('2026-08-01'), next: ep('2026-10-12') }, today)).toMatchObject({ kind: 'soon', inDays: 7 })
    expect(classifyShow({ last: null, next: ep('2026-12-12') }, today)).toBeNull()
  })
  it('lo nuevo gana sobre lo próximo', () => {
    expect(classifyShow({ last: ep('2026-10-03'), next: ep('2026-10-10') }, today).kind).toBe('new')
  })
  it('cruza cambio de mes', () => {
    expect(classifyShow({ last: null, next: ep('2026-11-01') }, '2026-10-30')).toMatchObject({ kind: 'soon', inDays: 2 })
  })
  it('sin datos devuelve null', () => { expect(classifyShow(null)).toBeNull() })
})

describe('followedShows', () => {
  it('une historial y lista, solo series, sin repetir, lo último primero', () => {
    const lib = {
      history: [
        { id: 1, type: 'tv', updatedAt: 1 }, { id: 2, type: 'tv', updatedAt: 9 }, { id: 3, type: 'movie', updatedAt: 99 },
      ],
      list: [{ id: 1, type: 'tv' }, { id: 4, type: 'tv' }, { id: 5, type: 'movie' }],
    }
    expect(followedShows(lib).map((s) => s.id)).toEqual([2, 1, 4])
  })
})
