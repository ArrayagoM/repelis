import { describe, it, expect } from 'vitest'
import { computeStreak, computeAchievements, newlyUnlocked } from '../achievements'

const lib = (over = {}) => ({
  list: [], reminders: [], days: [], daily: {}, seen: {}, genres: {}, minutes: 0, achSeen: [], history: [], ...over,
})

describe('computeStreak', () => {
  const today = '2026-10-05'
  it('sin actividad no hay racha', () => {
    expect(computeStreak([], today)).toEqual({ current: 0, best: 0, activeToday: false })
  })
  it('cuenta días consecutivos terminando hoy', () => {
    expect(computeStreak(['2026-10-03', '2026-10-04', '2026-10-05'], today)).toEqual({ current: 3, best: 3, activeToday: true })
  })
  it('la racha sigue viva si lo último fue ayer', () => {
    expect(computeStreak(['2026-10-03', '2026-10-04'], today)).toMatchObject({ current: 2, activeToday: false })
  })
  it('se corta si pasó más de un día', () => {
    expect(computeStreak(['2026-10-01', '2026-10-02'], today)).toMatchObject({ current: 0, best: 2 })
  })
  it('recuerda la mejor racha aunque la actual sea menor', () => {
    const days = ['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-10-05']
    expect(computeStreak(days, today)).toMatchObject({ current: 1, best: 4 })
  })
  it('cruza cambio de mes y año', () => {
    expect(computeStreak(['2026-12-31', '2027-01-01'], '2027-01-01').current).toBe(2)
  })
  it('ignora días duplicados', () => {
    expect(computeStreak(['2026-10-05', '2026-10-05'], today).current).toBe(1)
  })
})

describe('computeAchievements', () => {
  const byId = (list) => Object.fromEntries(list.map((a) => [a.id, a]))

  it('arranca todo bloqueado', () => {
    expect(computeAchievements(lib()).every((a) => !a.done)).toBe(true)
  })
  it('Primera función y Cinéfilo según títulos vistos', () => {
    const seen = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`movie:${i}`, 1]))
    const a = byId(computeAchievements(lib({ seen })))
    expect(a.first.done).toBe(true)
    expect(a.cinefilo.done).toBe(true)
    expect(a.devorador.done).toBe(false)
    expect(a.devorador.value).toBe(10)
  })
  it('Maratonista con 3 en un día', () => {
    const a = byId(computeAchievements(lib({ daily: { '2026-10-05': ['a', 'b', 'c'] } })))
    expect(a.maraton.done).toBe(true)
  })
  it('rachas usan la mejor racha histórica', () => {
    const days = ['2026-09-01', '2026-09-02', '2026-09-03']
    const a = byId(computeAchievements(lib({ days }), '2026-10-05'))
    expect(a.racha3.done).toBe(true)
    expect(a.racha7.done).toBe(false)
  })
  it('Explorador por géneros, Coleccionista por lista', () => {
    const genres = { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1 }
    const list = Array.from({ length: 10 }, (_, i) => ({ id: i, type: 'movie' }))
    const a = byId(computeAchievements(lib({ genres, list })))
    expect(a.explorador.done).toBe(true)
    expect(a.coleccion.done).toBe(true)
  })
  it('el valor no supera la meta', () => {
    const a = byId(computeAchievements(lib({ minutes: 99999 })))
    expect(a.horas10.value).toBe(600)
  })
})

describe('newlyUnlocked', () => {
  it('no repite los ya mostrados', () => {
    const l = lib({ seen: { 'movie:1': 1 } })
    expect(newlyUnlocked(l).map((a) => a.id)).toEqual(['first'])
    expect(newlyUnlocked({ ...l, achSeen: ['first'] })).toEqual([])
  })
})
