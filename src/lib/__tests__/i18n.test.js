import { describe, it, expect } from 'vitest'
import { pickLang, fromBrowser, translate, interpolate, SPANISH_COUNTRIES } from '../i18n'
import EN from '../../i18n/en'

describe('fromBrowser', () => {
  it('toma el primer idioma que sea español o inglés', () => {
    expect(fromBrowser(['pt-BR', 'en-US', 'es-AR'])).toBe('en')
    expect(fromBrowser(['es-MX', 'en'])).toBe('es')
  })
  it('devuelve null si no hay ninguno de los dos', () => {
    expect(fromBrowser(['de-DE', 'fr'])).toBeNull()
    expect(fromBrowser(undefined)).toBeNull()
  })
})

describe('pickLang', () => {
  it('lo elegido a mano gana a todo', () => {
    expect(pickLang({ stored: 'es', param: 'en', browser: ['en-US'], country: 'US' })).toBe('es')
  })
  it('?lang= gana al navegador', () => {
    expect(pickLang({ param: 'en', browser: ['es-AR'] })).toBe('en')
  })
  it('usa el idioma del navegador cuando es español o inglés', () => {
    expect(pickLang({ browser: ['en-GB'], country: 'AR' })).toBe('en')
    expect(pickLang({ browser: ['es-ES'], country: 'US' })).toBe('es')
  })
  it('con otro idioma de navegador decide el país', () => {
    expect(pickLang({ browser: ['de-DE'], country: 'MX' })).toBe('es')
    expect(pickLang({ browser: ['de-DE'], country: 'DE' })).toBe('en')
    expect(pickLang({ browser: ['fr'], country: 'br' })).toBe('en')
  })
  it('sin ningún dato queda en español', () => {
    expect(pickLang({})).toBe('es')
  })
  it('ignora valores inválidos', () => {
    expect(pickLang({ stored: 'xx', param: 'zz', browser: ['en'] })).toBe('en')
  })
  it('los países hispanohablantes incluyen LATAM y España', () => {
    for (const c of ['AR', 'MX', 'CO', 'CL', 'PE', 'ES', 'UY']) expect(SPANISH_COUNTRIES.has(c)).toBe(true)
    expect(SPANISH_COUNTRIES.has('US')).toBe(false)
  })
})

describe('translate', () => {
  it('en español devuelve el texto tal cual, con variables', () => {
    expect(translate('es', 'Hola, {name}', { name: 'Ana' }, EN)).toBe('Hola, Ana')
  })
  it('en inglés usa el diccionario', () => {
    expect(translate('en', 'Mi lista', undefined, EN)).toBe('My list')
    expect(translate('en', 'Hola, {name}', { name: 'Ana' }, EN)).toBe('Hi, Ana')
  })
  it('si falta la traducción muestra el español', () => {
    expect(translate('en', 'Texto que no existe aún', undefined, EN)).toBe('Texto que no existe aún')
  })
  it('interpolate deja intacta una variable sin valor', () => {
    expect(interpolate('Hola {x}', {})).toBe('Hola {x}')
  })
})

describe('diccionario', () => {
  it('conserva las variables {x} de cada clave en su traducción', () => {
    const bad = Object.entries(EN).filter(([es, en]) => {
      const vars = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')
      return vars(es) !== vars(en)
    })
    expect(bad.map(([k]) => k)).toEqual([])
  })
})
