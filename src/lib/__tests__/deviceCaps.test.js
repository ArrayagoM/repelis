import { describe, it, expect, beforeEach, vi } from 'vitest'

// Helper: resetea el módulo entre tests porque deviceCaps cachea internamente
const reloadDeviceCaps = async () => {
  vi.resetModules()
  const m = await import('../deviceCaps')
  return m
}

describe('deviceCaps', () => {
  beforeEach(() => {
    // Resetear navigator a defaults razonables
    Object.defineProperty(navigator, 'deviceMemory',       { value: 8,    configurable: true })
    Object.defineProperty(navigator, 'hardwareConcurrency',{ value: 8,    configurable: true })
    Object.defineProperty(navigator, 'userAgent',          { value: 'Mozilla/5.0 Chrome', configurable: true })
    Object.defineProperty(navigator, 'maxTouchPoints',     { value: 0,    configurable: true })
    Object.defineProperty(window,    'devicePixelRatio',   { value: 1.5,  configurable: true })
    Object.defineProperty(window.screen, 'width',          { value: 1920, configurable: true })
  })

  it('PC moderna no es low-end', async () => {
    const { getDeviceCaps } = await reloadDeviceCaps()
    expect(getDeviceCaps().lowEnd).toBe(false)
  })

  it('detecta low-end por deviceMemory <= 2', async () => {
    Object.defineProperty(navigator, 'deviceMemory', { value: 2, configurable: true })
    const { getDeviceCaps } = await reloadDeviceCaps()
    expect(getDeviceCaps().lowEnd).toBe(true)
  })

  it('detecta low-end por hardwareConcurrency <= 2', async () => {
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, configurable: true })
    const { getDeviceCaps } = await reloadDeviceCaps()
    expect(getDeviceCaps().lowEnd).toBe(true)
  })

  it('detecta SmartTV por user-agent', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (SMART-TV; LINUX) Tizen 6.0',
      configurable: true,
    })
    const { getDeviceCaps } = await reloadDeviceCaps()
    const caps = getDeviceCaps()
    expect(caps.lowEnd).toBe(true)
    expect(caps.isTV).toBe(true)
  })

  it('detecta FireTV por user-agent', async () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Linux; Android 9; AFTM)',
      configurable: true,
    })
    const { getDeviceCaps } = await reloadDeviceCaps()
    expect(getDeviceCaps().lowEnd).toBe(true)
  })

  it('detecta proyector por heurística (pantalla grande + DPR 1 + sin touch)', async () => {
    Object.defineProperty(window.screen, 'width',         { value: 1920, configurable: true })
    Object.defineProperty(window,        'devicePixelRatio', { value: 1, configurable: true })
    Object.defineProperty(navigator,     'maxTouchPoints', { value: 0,    configurable: true })
    delete window.ontouchstart
    window.matchMedia = vi.fn().mockImplementation((q) => ({
      matches: q.includes('coarse') || q.includes('hover: none'),
      media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    }))
    const { getDeviceCaps } = await reloadDeviceCaps()
    expect(getDeviceCaps().lowEnd).toBe(true)
  })

  it('saveData activa low-end', async () => {
    Object.defineProperty(navigator, 'connection', {
      value: { effectiveType: '4g', downlink: 10, saveData: true },
      configurable: true,
    })
    const { getDeviceCaps } = await reloadDeviceCaps()
    expect(getDeviceCaps().lowEnd).toBe(true)
  })
})
