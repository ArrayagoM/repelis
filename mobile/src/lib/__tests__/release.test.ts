import { byReleaseDate, isOut } from '@/lib/release'
import type { MediaItem } from '@/api/types'

const day = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10)
const m = (over: Partial<MediaItem>): MediaItem => ({ id: 1, ...over })

describe('release', () => {
  it('isOut: solo lo ya estrenado con fecha confirmada', () => {
    expect(isOut(m({ release_date: '2010-07-16' }))).toBe(true)
    expect(isOut(m({ first_air_date: '2008-01-20' }))).toBe(true)
    expect(isOut(m({ release_date: day(60) }))).toBe(false)
    expect(isOut(m({}))).toBe(false)
  })

  it('byReleaseDate ordena del estreno más cercano al más lejano', () => {
    const list = [m({ id: 3 }), m({ id: 2, release_date: day(40) }), m({ id: 1, release_date: day(5) })]
    expect(list.sort(byReleaseDate).map((x) => x.id)).toEqual([1, 2, 3])
  })
})
