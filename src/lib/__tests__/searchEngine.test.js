import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getHistory, addToHistory, removeFromHistory, clearHistory,
  getTitle, getYear, isPerson, isMovie, isTV,
} from '../searchEngine'

describe('searchEngine — history', () => {
  beforeEach(() => localStorage.clear())

  it('addToHistory agrega y devuelve en orden inverso (último primero)', () => {
    addToHistory('Inception')
    addToHistory('Matrix')
    expect(getHistory()).toEqual(['Matrix', 'Inception'])
  })

  it('addToHistory dedupea case-insensitive', () => {
    addToHistory('Matrix')
    addToHistory('matrix')
    expect(getHistory()).toEqual(['matrix'])
  })

  it('addToHistory ignora queries muy cortas', () => {
    addToHistory('a')
    addToHistory('')
    expect(getHistory()).toEqual([])
  })

  it('removeFromHistory saca uno solo', () => {
    addToHistory('Alpha'); addToHistory('Bravo'); addToHistory('Charlie')
    removeFromHistory('Bravo')
    expect(getHistory()).toEqual(['Charlie', 'Alpha'])
  })

  it('clearHistory vacía todo', () => {
    addToHistory('X'); addToHistory('Y')
    clearHistory()
    expect(getHistory()).toEqual([])
  })

  it('máximo 12 entradas (cap FIFO)', () => {
    for (let i = 0; i < 20; i++) addToHistory(`query-num-${i}`)
    expect(getHistory()).toHaveLength(12)
    expect(getHistory()[0]).toBe('query-num-19')
  })
})

describe('searchEngine — helpers', () => {
  it('getTitle prefiere title (movies) sobre name (tv/person)', () => {
    expect(getTitle({ title: 'Movie', name: 'X' })).toBe('Movie')
    expect(getTitle({ name: 'Series Name' })).toBe('Series Name')
    expect(getTitle({})).toBe('')
  })

  it('getYear extrae año desde release_date o first_air_date', () => {
    expect(getYear({ release_date: '2010-07-16' })).toBe(2010)
    expect(getYear({ first_air_date: '2008-01-20' })).toBe(2008)
    expect(getYear({})).toBe(null)
  })

  it('isPerson / isMovie / isTV correctos', () => {
    expect(isPerson({ media_type: 'person' })).toBe(true)
    expect(isMovie({ media_type: 'movie' })).toBe(true)
    expect(isTV({ media_type: 'tv' })).toBe(true)
    expect(isPerson({ media_type: 'movie' })).toBe(false)
  })
})
