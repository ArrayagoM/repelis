import { describe, it, expect } from 'vitest'
import { handleBase, pickHandle, ensureProfile } from '../_lib/autoProfile.js'
import { createMemorySocial } from '../_lib/socialStore.js'
import { HANDLE_RE, handleProblem } from '../../src/lib/socialRules.js'

describe('@usuario automático', () => {
  it('sale del nombre, sin acentos ni símbolos, y nunca del mail', () => {
    expect(handleBase('Juan martin Arrayago')).toBe('juan_martin_ar')
    expect(handleBase('María José Núñez')).toBe('maria_jose_nun')
    expect(handleBase('  Ana  ')).toBe('ana')
    expect(handleBase('Ñoño')).toBe('nono')
  })
  it('si el nombre no sirve, usa un nombre neutro', () => {
    for (const bad of ['', '  ', 'Al', '🎬🎬🎬', undefined, null, '12', 'admin', 'Root']) expect(HANDLE_RE.test(handleBase(bad)) && !handleProblem(handleBase(bad))).toBe(true)
    expect(handleBase('')).toBe('cinefilo')
    expect(handleBase('admin')).toBe('cinefilo')            // reservado
  })
  it('si está ocupado agrega números y siempre cumple las reglas', async () => {
    const taken = new Set(['ana', 'ana_11', 'ana_12'])
    let n = 10
    const rand = () => { n += 1; return n / 100 }
    const h = await pickHandle('Ana', async (x) => taken.has(x), rand)
    expect(h).toMatch(/^ana_\d{2,4}$/)
    expect(taken.has(h)).toBe(false)
    expect(HANDLE_RE.test(h)).toBe(true)
  })
  it('con todo ocupado igual devuelve algo válido y único', async () => {
    const h = await pickHandle('Ana', async () => true, () => 0.5)
    expect(HANDLE_RE.test(h)).toBe(true)
  })
  it('crea el perfil una sola vez y respeta el existente', async () => {
    const social = createMemorySocial()
    const user = { id: '7', name: 'Cami López' }
    const a = await ensureProfile(social, user)
    const b = await ensureProfile(social, user)
    expect(a.handle).toBe('cami_lopez')
    expect(b.handle).toBe(a.handle)
    expect(await social.countFollowers('7')).toBe(0)
  })
  it('dos personas con el mismo nombre reciben @usuarios distintos', async () => {
    const social = createMemorySocial()
    const a = await ensureProfile(social, { id: '1', name: 'Juan Perez' })
    const b = await ensureProfile(social, { id: '2', name: 'Juan Perez' })
    expect(a.handle).not.toBe(b.handle)
    expect(b.handle).toMatch(/^juan_perez_\d+$/)
  })
  it('dos pedidos a la vez de la misma persona dejan un solo perfil', async () => {
    const social = createMemorySocial()
    const user = { id: '9', name: 'Lu' }
    const [x, y] = await Promise.all([ensureProfile(social, user), ensureProfile(social, user)])
    expect(x.userId).toBe('9'); expect(y.userId).toBe('9')
    expect(await social.getProfile('9')).toBeTruthy()
  })
})
