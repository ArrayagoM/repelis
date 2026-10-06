import { describe, it, expect } from 'vitest'
import { pollDelay, mergeMessages } from '../rooms'

describe('cliente de salas', () => {
  it('consulta rápido si hay charla, lento si está quieto y muy lento en segundo plano', () => {
    const now = 1_000_000
    expect(pollDelay({ hidden: false, lastActivityAt: now - 5_000, now })).toBe(2500)
    expect(pollDelay({ hidden: false, lastActivityAt: now - 120_000, now })).toBe(5000)
    expect(pollDelay({ hidden: true, lastActivityAt: now, now })).toBe(15000)
  })
  it('junta mensajes sin repetir, ordenados y acotados', () => {
    const a = [{ seq: 1, text: 'a' }, { seq: 2, text: 'b' }]
    expect(mergeMessages(a, [])).toBe(a)
    expect(mergeMessages(a, [{ seq: 2, text: 'b' }])).toBe(a)                         // nada nuevo: misma referencia (sin re-render)
    expect(mergeMessages(a, [{ seq: 4, text: 'd' }, { seq: 3, text: 'c' }]).map((m) => m.seq)).toEqual([1, 2, 3, 4])
    const many = Array.from({ length: 400 }, (_, i) => ({ seq: i + 1 }))
    const out = mergeMessages([], many)
    expect(out).toHaveLength(300)
    expect(out.at(-1).seq).toBe(400)
  })
})
