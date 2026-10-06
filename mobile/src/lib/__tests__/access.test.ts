import { isLockedForUser, requiresAccount } from '@/lib/access'

describe('access (mismas reglas que la web)', () => {
  it('piden cuenta los más calificados y los más populares', () => {
    expect(requiresAccount({ type: 'movie', rating: 8.2, votes: 5000, pop: 20 })).toBe(true)
    expect(requiresAccount({ type: 'movie', rating: 6, votes: 50, pop: 300 })).toBe(true)
    expect(requiresAccount({ type: 'tv', rating: 8, votes: 2000, pop: 10 })).toBe(true)
  })
  it('lo demás es libre, y sin datos se deja ver', () => {
    expect(requiresAccount({ type: 'movie', rating: 6.5, votes: 800, pop: 40 })).toBe(false)
    expect(requiresAccount({ type: 'movie', rating: 9, votes: 10, pop: 5 })).toBe(false)
    expect(requiresAccount({ type: 'tv', pop: 300 })).toBe(false)      // en series la escala de popularidad es otra
    expect(requiresAccount({})).toBe(false)
    expect(requiresAccount(null)).toBe(false)
  })
  it('solo frena con sesión cerrada (o aún sin saber); con el servicio caído se deja ver', () => {
    const hot = { type: 'movie', rating: 8.5, votes: 9000, pop: 400 }
    expect(isLockedForUser(hot, 'out')).toBe(true)
    expect(isLockedForUser(hot, 'loading')).toBe(true)
    expect(isLockedForUser(hot, 'in')).toBe(false)
    expect(isLockedForUser(hot, 'unavailable')).toBe(false)
    expect(isLockedForUser({ type: 'movie', rating: 5, votes: 1, pop: 1 }, 'out')).toBe(false)
  })
})
