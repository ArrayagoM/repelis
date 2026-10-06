import { pageGroup, randomId, setWatching, getWatching, subscribeWatching } from '@/lib/pulse'

describe('pulse (app)', () => {
  it('agrupa las pantallas sin mandar rutas completas', () => {
    expect(pageGroup('/')).toBe('home')
    expect(pageGroup('/title/movie/603')).toBe('movie')
    expect(pageGroup('/title/tv/1396')).toBe('tv')
    expect(pageGroup('/player/tv/1396?season=1')).toBe('tv')
    expect(pageGroup('/search')).toBe('search')
    expect(pageGroup('/more')).toBe('cuenta')
    expect(pageGroup('/movies')).toBe('catalog')
  })
  it('el id de visitante es aleatorio y de forma válida para el servidor', () => {
    const a = randomId(), b = randomId()
    expect(a).toMatch(/^[A-Za-z0-9_-]{16,40}$/)
    expect(a).not.toBe(b)
  })
  it('avisa cuando cambia lo que se está mirando (y no repite lo mismo)', () => {
    const seen: Array<string | null> = []
    const off = subscribeWatching((w) => seen.push(w?.key ?? null))
    setWatching({ key: 'movie:1', title: 'A' })
    setWatching({ key: 'movie:1', title: 'A' })
    setWatching({ key: 'tv:2', title: 'B' })
    setWatching(null)
    off()
    expect(seen).toEqual(['movie:1', 'tv:2', null])
    expect(getWatching()).toBeNull()
  })
})
