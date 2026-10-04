import { filterResultsByMode, getDiscoverParamsForMode, isLanguageMode } from '@/lib/languageMode'
import type { MediaItem } from '@/api/types'

const item = (over: Partial<MediaItem>): MediaItem => ({ id: 1, ...over })

describe('languageMode', () => {
  const es = item({ id: 1, original_language: 'es' })
  const mx = item({ id: 2, original_language: 'en', origin_country: ['MX'] })
  const hit = item({ id: 3, original_language: 'en', origin_country: ['US'], popularity: 80 })
  const niche = item({ id: 4, original_language: 'en', origin_country: ['US'], popularity: 10 })
  const ja = item({ id: 5, original_language: 'ja', origin_country: ['JP'], popularity: 99 })
  const all = [es, mx, hit, niche, ja]

  it('all no filtra', () => {
    expect(filterResultsByMode(all, 'all')).toHaveLength(5)
  })

  it('strict deja solo original español', () => {
    expect(filterResultsByMode(all, 'strict').map((m) => m.id)).toEqual([1])
  })

  it('broad deja español, países LATAM y éxitos populares en inglés', () => {
    expect(filterResultsByMode(all, 'broad').map((m) => m.id)).toEqual([1, 2, 3])
  })

  it('params de discover por modo', () => {
    expect(getDiscoverParamsForMode('strict')).toEqual({ with_original_language: 'es' })
    expect(getDiscoverParamsForMode('broad').with_origin_country).toContain('MX')
    expect(getDiscoverParamsForMode('all')).toEqual({})
  })

  it('valida modos', () => {
    expect(isLanguageMode('broad')).toBe(true)
    expect(isLanguageMode('x')).toBe(false)
    expect(isLanguageMode(undefined)).toBe(false)
  })
})
