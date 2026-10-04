import { describe, it, expect, beforeEach } from 'vitest'
import {
  SOURCES,
  buildUrl,
  rememberSource,
  getOrderedSources,
  LATAM_PRIORITY_IDS,
} from '../playerSources'

describe('playerSources', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('SOURCES catalog', () => {
    it('debe tener al menos 10 servidores (los caídos están comentados, no listados)', () => {
      expect(SOURCES.length).toBeGreaterThanOrEqual(10)
    })

    it('cada source tiene id, label, movieUrl, tvUrl', () => {
      for (const s of SOURCES) {
        expect(s.id).toBeTruthy()
        expect(s.label).toBeTruthy()
        expect(typeof s.movieUrl).toBe('function')
        expect(typeof s.tvUrl).toBe('function')
      }
    })

    it('los IDs son únicos', () => {
      const ids = SOURCES.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
    })

    it('debe haber al menos 5 sources con esLat=true', () => {
      const latam = SOURCES.filter((s) => s.esLat === true)
      expect(latam.length).toBeGreaterThanOrEqual(5)
    })

    it('los primeros 5 servidores son esLat (prioridad LATAM)', () => {
      const top5 = SOURCES.slice(0, 5)
      const allLatam = top5.every((s) => s.esLat === true)
      expect(allLatam).toBe(true)
    })

    it('cada movieUrl devuelve un URL https válido con el ID', () => {
      for (const s of SOURCES) {
        const url = s.movieUrl(12345)
        expect(url).toMatch(/^https:\/\//)
        expect(url).toContain('12345')
      }
    })

    it('cada tvUrl devuelve un URL con id, season y episode', () => {
      for (const s of SOURCES) {
        const url = s.tvUrl(999, 3, 7)
        expect(url).toContain('999')
        expect(url).toMatch(/3|s.?3/i)
        expect(url).toMatch(/7|e.?7/i)
      }
    })
  })

  describe('buildUrl', () => {
    it('devuelve string vacío si no hay source o id', () => {
      expect(buildUrl(null, { mediaType: 'movie', id: 1 })).toBe('')
      expect(buildUrl(SOURCES[0], { mediaType: 'movie', id: null })).toBe('')
    })

    it('usa movieUrl cuando mediaType es movie', () => {
      const url = buildUrl(SOURCES[0], { mediaType: 'movie', id: 27205 })
      expect(url).toBe(SOURCES[0].movieUrl(27205))
    })

    it('usa tvUrl cuando mediaType es tv', () => {
      const url = buildUrl(SOURCES[0], { mediaType: 'tv', id: 1399, season: 2, episode: 5 })
      expect(url).toBe(SOURCES[0].tvUrl(1399, 2, 5))
    })
  })

  describe('rememberSource + getOrderedSources', () => {
    it('sin memoria, devuelve SOURCES en orden original', () => {
      const ordered = getOrderedSources()
      expect(ordered[0].id).toBe(SOURCES[0].id)
    })

    it('recordar un source fuera de LATAM_PRIORITY_IDS lo pone primero DESPUÉS de esos tres', () => {
      // 2embed-skin no está en el grupo de prioridad LATAM, así que
      // "primero" acá significa primero dentro del resto, no de toda la lista.
      const target = SOURCES.find((s) => s.id === '2embed-skin').id
      rememberSource(target)
      const ordered = getOrderedSources()
      const rest = ordered.filter((s) => !LATAM_PRIORITY_IDS.includes(s.id))
      expect(rest[0].id).toBe(target)
    })

    it('VidLink, EmbedMaster y 111Movies van SIEMPRE primero y en ese orden, incluso sobre el recordado', () => {
      // Confiar en un solo servidor deja afuera títulos que tienen doblaje
      // latino pero solo en otro de estos tres — por eso los tres van
      // siempre adelante, en orden fijo, sin importar velocidad ni recordado.
      rememberSource('2embed-skin')
      const ordered = getOrderedSources()
      expect(ordered.slice(0, 3).map((s) => s.id)).toEqual(LATAM_PRIORITY_IDS)
    })

    it('recordar source preserva los otros (sin duplicados)', () => {
      rememberSource(SOURCES.find((s) => s.id === '2embed-skin').id)
      const ordered = getOrderedSources()
      const ids = ordered.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      expect(ordered.length).toBe(SOURCES.length)
    })

    it('rememberSource(falsy) no rompe', () => {
      expect(() => rememberSource(null)).not.toThrow()
      expect(() => rememberSource('')).not.toThrow()
      expect(() => rememberSource(undefined)).not.toThrow()
    })

    it('source desconocido en memoria no rompe (se ignora)', () => {
      localStorage.setItem('repelis:lastSource:v1', 'servidor-que-no-existe')
      expect(() => getOrderedSources()).not.toThrow()
      const ordered = getOrderedSources()
      expect(ordered.length).toBe(SOURCES.length)
    })
  })
})
