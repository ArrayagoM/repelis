import { describe, it, expect, beforeEach } from 'vitest'
import {
  getLibrary, reloadLibrary, toLibItem, toggleList, isInList, recordWatch, continueWatching,
  progressOf, removeHistory, toggleReminder, isReminded, todayStr,
} from '../library'

const movie = toLibItem({ id: 10, title: 'Peli', poster_path: '/p.jpg', release_date: '2020-01-01', genre_ids: [28, 12] }, 'movie')
const show = toLibItem({ id: 20, name: 'Serie', poster_path: '/s.jpg', first_air_date: '2019-05-05', genres: [{ id: 18 }], number_of_seasons: 3 }, 'tv')

beforeEach(() => { localStorage.clear(); reloadLibrary() })

describe('toLibItem', () => {
  it('normaliza películas y series de TMDB', () => {
    expect(movie).toMatchObject({ id: 10, type: 'movie', title: 'Peli', poster: '/p.jpg', genres: [28, 12] })
    expect(show).toMatchObject({ id: 20, type: 'tv', title: 'Serie', genres: [18], totalSeasons: 3 })
  })
  it('devuelve null sin datos', () => { expect(toLibItem(null)).toBeNull() })
})

describe('Mi lista', () => {
  it('agrega y quita, y persiste', () => {
    expect(toggleList(movie)).toBe(true)
    expect(isInList(getLibrary(), 'movie', 10)).toBe(true)
    reloadLibrary()
    expect(isInList(getLibrary(), 'movie', 10)).toBe(true)
    expect(toggleList(movie)).toBe(false)
    expect(isInList(getLibrary(), 'movie', 10)).toBe(false)
  })
  it('distingue película y serie con el mismo id', () => {
    toggleList(movie)
    expect(isInList(getLibrary(), 'tv', 10)).toBe(false)
  })
})

describe('Continuar viendo', () => {
  it('no aparece hasta 1 minuto de reproducción', () => {
    recordWatch(movie, { runtimeMin: 100, seconds: 30 })
    expect(continueWatching(getLibrary())).toHaveLength(0)
    recordWatch(movie, { runtimeMin: 100, seconds: 40 })
    const [h] = continueWatching(getLibrary())
    expect(h.id).toBe(10)
    expect(progressOf(h)).toBeCloseTo(70 / 6000)
  })

  it('una película terminada sale de la fila', () => {
    recordWatch(movie, { runtimeMin: 10, seconds: 600 })
    expect(continueWatching(getLibrary())).toHaveLength(0)
  })

  it('una serie con episodio terminado propone el siguiente', () => {
    recordWatch(show, { season: 1, episode: 3, runtimeMin: 40, seconds: 40 * 60 })
    const [h] = continueWatching(getLibrary())
    expect(h).toMatchObject({ next: true, nextSeason: 1, nextEpisode: 4 })
  })

  it('cambiar de episodio reinicia el progreso del episodio', () => {
    recordWatch(show, { season: 1, episode: 1, runtimeMin: 40, seconds: 600 })
    recordWatch(show, { season: 1, episode: 2, runtimeMin: 40, seconds: 120 })
    const entry = getLibrary().history[0]
    expect(entry).toMatchObject({ season: 1, episode: 2, watchedSec: 120 })
  })

  it('lo más reciente va primero y se puede quitar', () => {
    recordWatch(movie, { runtimeMin: 100, seconds: 120 })
    recordWatch(show, { season: 1, episode: 1, runtimeMin: 40, seconds: 120 })
    expect(continueWatching(getLibrary()).map((h) => h.id)).toEqual([20, 10])
    removeHistory('tv', 20)
    expect(continueWatching(getLibrary()).map((h) => h.id)).toEqual([10])
  })

  it('no pisa el póster guardado con null', () => {
    recordWatch(movie, { runtimeMin: 100, seconds: 60 })
    recordWatch({ ...movie, poster: null }, { runtimeMin: 100, seconds: 60 })
    expect(getLibrary().history[0].poster).toBe('/p.jpg')
  })
})

describe('estadísticas', () => {
  it('registra el día, los minutos y los géneros una sola vez por título', () => {
    recordWatch(movie, { runtimeMin: 100, seconds: 60 })
    recordWatch(movie, { runtimeMin: 100, seconds: 60 })
    const lib = getLibrary()
    expect(lib.days).toEqual([todayStr()])
    expect(lib.minutes).toBeCloseTo(2)
    expect(lib.genres).toEqual({ 28: 1, 12: 1 })
    expect(Object.keys(lib.seen)).toEqual(['movie:10'])
  })
})

describe('recordatorios', () => {
  it('alterna el recordatorio', () => {
    expect(toggleReminder(movie)).toBe(true)
    expect(isReminded(getLibrary(), 'movie', 10)).toBe(true)
    expect(toggleReminder(movie)).toBe(false)
  })
})

describe('datos corruptos', () => {
  it('se recupera de un localStorage inválido', () => {
    localStorage.setItem('lifehigh:library:v1', '{no es json')
    reloadLibrary()
    expect(getLibrary().list).toEqual([])
  })
})
