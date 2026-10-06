import { describe, it, expect } from 'vitest'
import { requiresAccount, isLockedForUser, safeRedirect, canUsePersonal, ACCESS_RULES } from '../access'
import { toLibItem } from '../library'
import { normalizeLibrary } from '../libraryMerge'

const movie = (over) => ({ type: 'movie', rating: 6, votes: 50, pop: 10, ...over })
const tv = (over) => ({ type: 'tv', rating: 6, votes: 50, pop: 10, ...over })

describe('requiresAccount — películas', () => {
  it('lo común y poco conocido se ve libre', () => {
    expect(requiresAccount(movie())).toBe(false)
    expect(requiresAccount(movie({ rating: 9.5, votes: 40 }))).toBe(false)         // nota alta pero casi sin votos
    expect(requiresAccount(movie({ rating: 6.9, votes: 50000 }))).toBe(false)      // muy votada pero nota normal
  })
  it('las más calificadas piden cuenta (nota ≥ 7.5 y ≥ 1000 votos)', () => {
    expect(requiresAccount(movie({ rating: 7.5, votes: 1000 }))).toBe(true)
    expect(requiresAccount(movie({ rating: 8.7, votes: 25000 }))).toBe(true)
    expect(requiresAccount(movie({ rating: 7.49, votes: 5000 }))).toBe(false)
    expect(requiresAccount(movie({ rating: 8, votes: 999 }))).toBe(false)
  })
  it('las más populares piden cuenta (popularidad ≥ 150) aunque la nota sea normal', () => {
    expect(requiresAccount(movie({ pop: 150 }))).toBe(true)
    expect(requiresAccount(movie({ pop: 149.9 }))).toBe(false)
  })
})

describe('requiresAccount — series', () => {
  it('usan otra escala de popularidad (si no, casi todas quedarían bloqueadas)', () => {
    expect(requiresAccount(tv({ pop: 200 }))).toBe(false)
    expect(requiresAccount(tv({ pop: 500 }))).toBe(true)
    expect(requiresAccount(tv({ rating: 8.4, votes: 3000 }))).toBe(true)
  })
  it('los umbrales están definidos por tipo', () => {
    expect(ACCESS_RULES.tv.popularity).toBeGreaterThan(ACCESS_RULES.movie.popularity)
  })
})

describe('requiresAccount — datos faltantes (ante la duda, libre)', () => {
  it('sin item o sin datos de puntaje no bloquea', () => {
    for (const x of [null, undefined, {}, { type: 'movie' }, { type: 'movie', rating: null, votes: null, pop: null }, { type: 'movie', rating: 'x', votes: 'y', pop: 'z' }]) {
      expect(requiresAccount(x)).toBe(false)
    }
  })
})

describe('isLockedForUser', () => {
  const top = movie({ rating: 8.5, votes: 9000 })
  it('bloquea sin sesión (y mientras se verifica la sesión)', () => {
    expect(isLockedForUser(top, 'out')).toBe(true)
    expect(isLockedForUser(top, 'loading')).toBe(true)
  })
  it('con sesión, o si las cuentas no están disponibles, se deja ver', () => {
    expect(isLockedForUser(top, 'in')).toBe(false)
    expect(isLockedForUser(top, 'unavailable')).toBe(false)
  })
  it('lo libre nunca se bloquea', () => {
    expect(isLockedForUser(movie(), 'out')).toBe(false)
  })
})

describe('el puntaje viaja con el título', () => {
  it('toLibItem guarda nota, votos y popularidad de TMDB', () => {
    const it = toLibItem({ id: 1, title: 'X', vote_average: 8.2, vote_count: 4200, popularity: 77.3 }, 'movie')
    expect(it).toMatchObject({ rating: 8.2, votes: 4200, pop: 77.3 })
    expect(requiresAccount(it)).toBe(true)
  })
  it('sin datos de TMDB no inventa nada', () => {
    const it = toLibItem({ id: 1, title: 'X' }, 'movie')
    expect(it.rating).toBeUndefined()
    expect(requiresAccount(it)).toBe(false)
  })
  it('sobrevive al guardado de la biblioteca (para Continuar viendo)', () => {
    const saved = normalizeLibrary({ list: [{ id: 1, type: 'movie', title: 'X', rating: 8.2, votes: 4200, pop: 77.3 }] })
    expect(saved.list[0]).toMatchObject({ rating: 8.2, votes: 4200, pop: 77.3 })
  })
  it('descarta valores no numéricos', () => {
    const saved = normalizeLibrary({ list: [{ id: 1, type: 'movie', title: 'X', rating: 'alto', votes: null }] })
    expect(saved.list[0].rating).toBeUndefined()
    expect(saved.list[0].votes).toBeUndefined()
  })
})

describe('safeRedirect', () => {
  it('acepta rutas internas', () => {
    expect(safeRedirect('/movie/603')).toBe('/movie/603')
    expect(safeRedirect('/tv/1396?x=1')).toBe('/tv/1396?x=1')
    expect(safeRedirect('/')).toBe('/')
  })
  it('rechaza otros sitios y rutas peligrosas', () => {
    for (const bad of ['https://evil.com', '//evil.com', '/\\evil.com', 'javascript:alert(1)', '/cuenta', '/cuenta/restablecer', '/api/auth/me', '/a b', '', null, undefined, 42, `/${'x'.repeat(300)}`]) {
      expect(safeRedirect(bad)).toBeNull()
    }
  })
})

describe('canUsePersonal (Mi lista, Continuar viendo, recomendadas, logros)', () => {
  it('solo con cuenta', () => {
    expect(canUsePersonal('in')).toBe(true)
    expect(canUsePersonal('out')).toBe(false)
    expect(canUsePersonal('loading')).toBe(false)
  })
  it('si el servicio de cuentas no está disponible, sigue funcionando en el dispositivo', () => {
    expect(canUsePersonal('unavailable')).toBe(true)
  })
})
