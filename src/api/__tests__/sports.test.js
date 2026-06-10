import { describe, it, expect } from 'vitest'
import { LEAGUE_IDS } from '../sports'
import { LEGAL_BROADCASTERS_AR, buildStreamUrl } from '../sportsStreams'

describe('sports — LEAGUE_IDS', () => {
  it('WORLD_CUP_2026 tiene el ID oficial de TheSportsDB', () => {
    expect(LEAGUE_IDS.WORLD_CUP_2026).toBe(4429)
  })

  it('todos los IDs son números', () => {
    for (const [k, v] of Object.entries(LEAGUE_IDS)) {
      expect(typeof v).toBe('number')
      expect(v).toBeGreaterThan(0)
    }
  })
})

describe('sportsStreams — LEGAL_BROADCASTERS_AR', () => {
  it('lista al menos 4 broadcasters legales', () => {
    expect(LEGAL_BROADCASTERS_AR.length).toBeGreaterThanOrEqual(4)
  })

  it('incluye TV Pública (transmisión oficial gratuita)', () => {
    const tvp = LEGAL_BROADCASTERS_AR.find((b) => b.name === 'TV Pública')
    expect(tvp).toBeTruthy()
    expect(tvp.url).toContain('tvpublica')
  })

  it('cada broadcaster tiene name, url y description', () => {
    for (const b of LEGAL_BROADCASTERS_AR) {
      expect(b.name).toBeTruthy()
      expect(b.url).toMatch(/^https?:\/\//)
      expect(b.description).toBeTruthy()
    }
  })
})

describe('sportsStreams — buildStreamUrl', () => {
  it('construye URL del embed correctamente', () => {
    const url = buildStreamUrl('alpha', 2)
    expect(url).toContain('alpha')
    expect(url).toContain('/2')
  })

  it('streamNo default a 1', () => {
    const url = buildStreamUrl('beta')
    expect(url).toContain('/1')
  })
})
