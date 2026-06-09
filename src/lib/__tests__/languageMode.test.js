import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getLanguageMode, setLanguageMode, subscribeLanguageMode,
  getDiscoverParamsForMode, filterResultsByMode,
} from '../languageMode'

describe('languageMode — modo activo', () => {
  beforeEach(() => localStorage.clear())

  it('default es "broad"', () => {
    expect(getLanguageMode()).toBe('broad')
  })

  it('setLanguageMode persiste', () => {
    setLanguageMode('strict')
    expect(getLanguageMode()).toBe('strict')
    setLanguageMode('all')
    expect(getLanguageMode()).toBe('all')
  })

  it('ignora valores inválidos (vuelve a default)', () => {
    setLanguageMode('hackeo')
    expect(getLanguageMode()).toBe('broad')
  })

  it('subscribe notifica a listeners', () => {
    const fn = vi.fn()
    const unsub = subscribeLanguageMode(fn)
    expect(fn).toHaveBeenCalledWith('broad')

    setLanguageMode('strict')
    expect(fn).toHaveBeenCalledWith('strict')

    unsub()
    setLanguageMode('all')
    // No debería haberse llamado de nuevo después de unsub
    expect(fn).toHaveBeenCalledTimes(2)
  })
})

describe('getDiscoverParamsForMode', () => {
  it('strict pone with_original_language=es', () => {
    expect(getDiscoverParamsForMode('strict')).toEqual({ with_original_language: 'es' })
  })

  it('broad pone with_origin_country LATAM', () => {
    const p = getDiscoverParamsForMode('broad')
    expect(p.with_origin_country).toContain('MX')
    expect(p.with_origin_country).toContain('AR')
    expect(p.with_origin_country).toContain('ES')
  })

  it('all no agrega filtros', () => {
    expect(getDiscoverParamsForMode('all')).toEqual({})
  })
})

describe('filterResultsByMode', () => {
  const sample = [
    { id: 1, title: 'Coco',           original_language: 'en', origin_country: ['US'], popularity: 60 },
    { id: 2, title: 'Roma',           original_language: 'es', origin_country: ['MX'], popularity: 80 },
    { id: 3, title: 'El Secreto',     original_language: 'es', origin_country: ['AR'], popularity: 50 },
    { id: 4, title: 'Pulp Fiction',   original_language: 'en', origin_country: ['US'], popularity: 200 },
    { id: 5, title: 'Indie',          original_language: 'fr', origin_country: ['FR'], popularity: 5 },
    { id: 6, title: 'Spanish prod',   original_language: 'es', origin_country: ['ES'], popularity: 30 },
  ]

  it('all devuelve TODOS', () => {
    const r = filterResultsByMode(sample, 'all')
    expect(r).toHaveLength(6)
  })

  it('strict devuelve solo es (3)', () => {
    const r = filterResultsByMode(sample, 'strict')
    expect(r.map((x) => x.id).sort()).toEqual([2, 3, 6])
  })

  it('broad incluye es + origin LATAM + populares EN', () => {
    const r = filterResultsByMode(sample, 'broad')
    const ids = r.map((x) => x.id)
    expect(ids).toContain(2)   // es MX
    expect(ids).toContain(3)   // es AR
    expect(ids).toContain(6)   // es ES
    expect(ids).toContain(4)   // popular EN
    expect(ids).not.toContain(5) // FR no popular
  })

  it('lista vacía devuelve vacío', () => {
    expect(filterResultsByMode([], 'strict')).toEqual([])
  })
})
