import { describe, it, expect, beforeEach } from 'vitest'
import {
  CHAINS, COUNTRIES, theaterStatus, countryFromTimezone, countryFromLocale, detectCountry,
  setStoredCountry, getStoredCountry, chainsFor, IN_THEATERS_DAYS, PRESALE_DAYS,
} from '../cinemas'

const DAY = 86400000
const now = Date.UTC(2026, 9, 5)
const at = (offsetDays) => new Date(now + offsetDays * DAY).toISOString().slice(0, 10)

beforeEach(() => localStorage.clear())

describe('enlaces de cines (seguridad)', () => {
  const all = Object.entries(CHAINS).flatMap(([country, list]) => list.map((c) => ({ country, ...c })))

  it('hay cadenas para cada país soportado', () => {
    for (const code of Object.keys(COUNTRIES)) expect(CHAINS[code]?.length).toBeGreaterThan(0)
  })
  it('todos los enlaces son https, sin parámetros ni fragmentos', () => {
    for (const c of all) {
      const u = new URL(c.url)
      expect(u.protocol, c.id).toBe('https:')
      expect(u.search, c.id).toBe('')
      expect(u.hash, c.id).toBe('')
      expect(u.username + u.password, c.id).toBe('')
    }
  })
  it('ids únicos y nombres no vacíos', () => {
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length)
    for (const c of all) expect(c.name.length).toBeGreaterThan(1)
  })
  it('los dominios son de las cadenas conocidas', () => {
    const allowed = /(cinemark|cinepolis|cinemex|todoshowcase|cinecolombia|cineplanet|movie\.com\.uy|lifecinemas|cinesa|yelmocines)/
    for (const c of all) expect(new URL(c.url).hostname, c.id).toMatch(allowed)
  })
})

describe('theaterStatus', () => {
  it('en cartelera: estrenada hace poco', () => {
    expect(theaterStatus({ release_date: at(-10) }, now)).toBe('now')
    expect(theaterStatus({ release_date: at(0) }, now)).toBe('now')
    expect(theaterStatus({ release_date: at(-IN_THEATERS_DAYS) }, now)).toBe('now')
  })
  it('ya salió hace mucho: no está en cines', () => {
    expect(theaterStatus({ release_date: at(-IN_THEATERS_DAYS - 5) }, now)).toBeNull()
  })
  it('preventa: se estrena en las próximas semanas', () => {
    expect(theaterStatus({ release_date: at(7) }, now)).toBe('presale')
    expect(theaterStatus({ release_date: at(PRESALE_DAYS) }, now)).toBe('presale')
  })
  it('falta mucho: todavía no', () => {
    expect(theaterStatus({ release_date: at(PRESALE_DAYS + 5) }, now)).toBeNull()
  })
  it('sin fecha o inválida: null', () => {
    expect(theaterStatus({}, now)).toBeNull()
    expect(theaterStatus({ release_date: 'basura' }, now)).toBeNull()
    expect(theaterStatus(null, now)).toBeNull()
  })
  it('acepta el formato de la biblioteca (date)', () => {
    expect(theaterStatus({ date: at(-3) }, now)).toBe('now')
  })
})

describe('detección de país', () => {
  it('por zona horaria', () => {
    expect(countryFromTimezone('America/Argentina/Buenos_Aires')).toBe('AR')
    expect(countryFromTimezone('America/Argentina/Cordoba')).toBe('AR')
    expect(countryFromTimezone('America/Mexico_City')).toBe('MX')
    expect(countryFromTimezone('Europe/Madrid')).toBe('ES')
    expect(countryFromTimezone('Asia/Tokyo')).toBeNull()
    expect(countryFromTimezone(undefined)).toBeNull()
  })
  it('por idioma del navegador', () => {
    expect(countryFromLocale('es-AR')).toBe('AR')
    expect(countryFromLocale('es_CO')).toBe('CO')
    expect(countryFromLocale('en-US')).toBeNull()
    expect(countryFromLocale('es')).toBeNull()
  })
  it('lo que elige el usuario gana, y se puede borrar', () => {
    setStoredCountry('CL')
    expect(getStoredCountry()).toBe('CL')
    expect(detectCountry()).toBe('CL')
    setStoredCountry('ZZ')
    expect(getStoredCountry()).toBeNull()
  })
  it('chainsFor devuelve [] para países sin cadenas', () => {
    expect(chainsFor('ZZ')).toEqual([])
    expect(chainsFor('AR').length).toBeGreaterThan(0)
  })
})
