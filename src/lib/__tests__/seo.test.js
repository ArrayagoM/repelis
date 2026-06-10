import { describe, it, expect, beforeEach } from 'vitest'
import { setPageSEO, setMovieSchema, setTVSchema, BRAND_NAME } from '../seo'

describe('seo — setPageSEO', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.title = ''
  })

  it('setea title con brand al final', () => {
    setPageSEO({ title: 'Ver Inception' })
    expect(document.title).toBe(`Ver Inception — ${BRAND_NAME}`)
  })

  it('sin title usa el default brand + tagline', () => {
    setPageSEO({})
    expect(document.title).toBe(`${BRAND_NAME} — Cinema sin límites`)
  })

  it('setea meta description', () => {
    setPageSEO({ description: 'Mi descripción' })
    const el = document.head.querySelector('meta[name="description"]')
    expect(el?.getAttribute('content')).toBe('Mi descripción')
  })

  it('noindex activa robots noindex', () => {
    setPageSEO({ noindex: true })
    const el = document.head.querySelector('meta[name="robots"]')
    expect(el?.getAttribute('content')).toContain('noindex')
  })

  it('por default robots permite index', () => {
    setPageSEO({})
    const el = document.head.querySelector('meta[name="robots"]')
    expect(el?.getAttribute('content')).toContain('index')
    expect(el?.getAttribute('content')).not.toContain('noindex')
  })

  it('setea open graph', () => {
    setPageSEO({ title: 'X', image: 'https://img.example/x.jpg' })
    expect(document.head.querySelector('meta[property="og:title"]')?.getAttribute('content')).toContain('X')
    expect(document.head.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://img.example/x.jpg')
  })

  it('setea canonical link', () => {
    setPageSEO({ url: 'https://example.com/x' })
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe('https://example.com/x')
  })

  it('llamadas repetidas no duplican tags', () => {
    setPageSEO({ description: 'A' })
    setPageSEO({ description: 'B' })
    const all = document.head.querySelectorAll('meta[name="description"]')
    expect(all.length).toBe(1)
    expect(all[0].getAttribute('content')).toBe('B')
  })
})

describe('seo — setMovieSchema', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  it('inserta JSON-LD válido con type Movie', () => {
    setMovieSchema({
      title: 'Inception',
      overview: 'Dom Cobb...',
      release_date: '2010-07-16',
      runtime: 148,
      original_language: 'en',
      vote_average: 8.4,
      vote_count: 30000,
    })
    const el = document.head.querySelector('script[type="application/ld+json"]')
    expect(el).toBeTruthy()
    const data = JSON.parse(el.textContent)
    expect(data['@type']).toBe('Movie')
    expect(data.name).toBe('Inception')
    expect(data.duration).toBe('PT148M')
    expect(data.aggregateRating.ratingValue).toBe(8.4)
  })

  it('no rompe si movie es null', () => {
    expect(() => setMovieSchema(null)).not.toThrow()
  })
})

describe('seo — setTVSchema', () => {
  beforeEach(() => { document.head.innerHTML = '' })

  it('inserta JSON-LD válido con type TVSeries', () => {
    setTVSchema({
      name: 'Breaking Bad',
      overview: 'Walter White...',
      first_air_date: '2008-01-20',
      number_of_seasons: 5,
      number_of_episodes: 62,
      original_language: 'en',
    })
    const el = document.head.querySelector('script[type="application/ld+json"]')
    expect(el).toBeTruthy()
    const data = JSON.parse(el.textContent)
    expect(data['@type']).toBe('TVSeries')
    expect(data.numberOfSeasons).toBe(5)
    expect(data.numberOfEpisodes).toBe(62)
  })
})
