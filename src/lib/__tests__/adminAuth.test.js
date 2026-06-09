import { describe, it, expect, beforeEach, vi } from 'vitest'

// Setea VITE_ADMIN_PIN via stubEnv (Vitest la inyecta en import.meta.env)
const setEnv = (pin) => {
  vi.stubEnv('VITE_ADMIN_PIN', pin)
}

const reload = async () => {
  vi.resetModules()
  return import('../adminAuth')
}

describe('adminAuth', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllEnvs()
  })

  it('sin PIN configurado: adminConfigured = false, todo permitido', async () => {
    setEnv('')
    const { adminConfigured, adminIsAuthed, adminLogin } = await reload()
    expect(adminConfigured()).toBe(false)
    expect(adminIsAuthed()).toBe(true)
    expect(adminLogin('cualquier')).toBe(true)
  })

  it('con PIN configurado: login válido devuelve true', async () => {
    setEnv('1234')
    const { adminLogin, adminIsAuthed } = await reload()
    expect(adminLogin('1234')).toBe(true)
    expect(adminIsAuthed()).toBe(true)
  })

  it('con PIN configurado: login inválido devuelve false', async () => {
    setEnv('1234')
    const { adminLogin, adminIsAuthed } = await reload()
    expect(adminLogin('0000')).toBe(false)
    expect(adminIsAuthed()).toBe(false)
  })

  it('adminLogout limpia la sesión', async () => {
    setEnv('1234')
    const { adminLogin, adminIsAuthed, adminLogout } = await reload()
    adminLogin('1234')
    expect(adminIsAuthed()).toBe(true)
    adminLogout()
    expect(adminIsAuthed()).toBe(false)
  })

  it('sesión expira tras 8h (simulado)', async () => {
    setEnv('1234')
    const { adminLogin, adminIsAuthed } = await reload()
    adminLogin('1234')
    expect(adminIsAuthed()).toBe(true)

    const raw = localStorage.getItem('repelis:adminSession:v1')
    const parsed = JSON.parse(raw)
    parsed.ts = Date.now() - (9 * 3600 * 1000)
    localStorage.setItem('repelis:adminSession:v1', JSON.stringify(parsed))

    expect(adminIsAuthed()).toBe(false)
  })
})
