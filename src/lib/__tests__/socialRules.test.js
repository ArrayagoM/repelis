import { describe, it, expect } from 'vitest'
import {
  LIMITS, normalizeHandle, handleProblem, cleanText, hasLink, sanitizeItem, validateListInput, validateBio, socialErrorMessage,
} from '../socialRules'

const user = { premium: false }
const premium = { premium: true }
const item = (id, over = {}) => ({ type: 'movie', id, title: `Peli ${id}`, poster: '/abc.jpg', year: '2020', ...over })
const input = (over = {}) => ({ title: 'Plan de finde', description: 'Para ver con amigos', tag: 'finde', visibility: 'public', items: [item(1), item(2)], ...over })

describe('@usuario', () => {
  it('normaliza: minúsculas, sin @, sin espacios', () => {
    expect(normalizeHandle('  @Juan_23 ')).toBe('juan_23')
    expect(normalizeHandle(null)).toBe('')
  })
  it('acepta de 3 a 20 caracteres [a-z0-9_]', () => {
    for (const ok of ['abc', 'juan_23', 'a'.repeat(20), 'x_y_z']) expect(handleProblem(ok)).toBeNull()
  })
  it('rechaza formatos inválidos', () => {
    for (const bad of ['ab', 'a'.repeat(21), 'con espacio', 'ñandú', 'a.b', 'a-b', 'UPPER', '', '<script>', '../x']) expect(handleProblem(bad)).toBe('handle_invalid')
  })
  it('reserva nombres que suplantarían al equipo', () => {
    for (const r of ['admin', 'root', 'lifehigh', 'soporte', 'moderador', 'panel', 'fundador']) expect(handleProblem(r)).toBe('handle_reserved')
  })
})

describe('texto', () => {
  it('reemplaza caracteres de control y < > por espacios, colapsa espacios y recorta', () => {
    expect(cleanText('  hola\n\n  <b>mundo</b>\u0000  ', 50)).toBe('hola b mundo /b')
    expect(cleanText('x'.repeat(500), 80)).toHaveLength(80)
    expect(cleanText(undefined, 10)).toBe('')
  })
  it('detecta links en todas sus formas', () => {
    for (const t of ['mirá https://x.com', 'http://a.b', 'www.sitio', 'entrá a sitio.com', 'bit.ly/abc', 'mi.site', 'foo.xyz/path', 'HTTPS://MAYUS']) expect(hasLink(t)).toBe(true)
  })
  it('no marca texto normal', () => {
    for (const t of ['Una maratón de terror para el finde', 'Spider-Man: Un nuevo día', 'Rápidos y furiosos 10, la mejor', 'a las 21:30 empezamos']) expect(hasLink(t)).toBe(false)
  })
})

describe('sanitizeItem', () => {
  it('arma la clave y limpia los campos', () => {
    expect(sanitizeItem({ type: 'tv', id: '1396', title: '  Breaking <b>Bad', poster: '/a.jpg', year: 2008, note: ' muy buena ' }))
      .toEqual({ key: 'tv:1396', type: 'tv', id: 1396, title: 'Breaking b Bad', poster: '/a.jpg', year: '2008', note: 'muy buena' })
  })
  it('descarta lo inválido', () => {
    for (const bad of [null, {}, { type: 'x', id: 1, title: 't' }, { type: 'movie', id: -1, title: 't' }, { type: 'movie', id: 'a', title: 't' }, { type: 'movie', id: 1, title: '   ' }]) expect(sanitizeItem(bad)).toBeNull()
  })
  it('un póster raro se descarta (nunca se arma una URL con datos del cliente)', () => {
    expect(sanitizeItem({ type: 'movie', id: 1, title: 't', poster: 'https://evil.com/x.jpg' }).poster).toBeNull()
    expect(sanitizeItem({ type: 'movie', id: 1, title: 't', poster: '/../../etc' }).poster).toBeNull()
  })
})

describe('validateListInput', () => {
  it('una lista válida sale limpia', () => {
    const r = validateListInput(input(), user)
    expect(r.value).toMatchObject({ title: 'Plan de finde', tag: 'finde', visibility: 'public' })
    expect(r.value.items.map((i) => i.key)).toEqual(['movie:1', 'movie:2'])
  })
  it('exige título de al menos 3 letras', () => {
    expect(validateListInput(input({ title: 'ab' }), user).error).toBe('title_required')
    expect(validateListInput(input({ title: '   ' }), user).error).toBe('title_required')
  })
  it('rechaza links en título, descripción y notas', () => {
    expect(validateListInput(input({ title: 'mirá sitio.com' }), user).error).toBe('text_links')
    expect(validateListInput(input({ description: 'https://x.com' }), user).error).toBe('text_links')
    expect(validateListInput(input({ items: [item(1, { note: 'www.malo.ar' })] }), user).error).toBe('text_links')
  })
  it('etiqueta desconocida → "otro"; visibilidad por defecto pública', () => {
    expect(validateListInput(input({ tag: 'hack' }), user).value.tag).toBe('otro')
    expect(validateListInput(input({ visibility: undefined }), user).value.visibility).toBe('public')
  })
  it('las listas privadas son solo Premium', () => {
    expect(validateListInput(input({ visibility: 'private' }), user).error).toBe('private_requires_premium')
    expect(validateListInput(input({ visibility: 'private' }), premium).value.visibility).toBe('private')
  })
  it('quita repetidos y basura, y respeta el máximo del plan', () => {
    const dup = validateListInput(input({ items: [item(1), item(1), { type: 'x' }, item(2)] }), user)
    expect(dup.value.items).toHaveLength(2)
    const many = Array.from({ length: LIMITS.free.items + 1 }, (_, i) => item(i + 1))
    expect(validateListInput(input({ items: many }), user).error).toBe('too_many_items')
    expect(validateListInput(input({ items: many }), premium).value.items).toHaveLength(LIMITS.free.items + 1)
  })
  it('no revienta con entradas raras', () => {
    for (const bad of [null, undefined, 'x', 5, [], { items: 'no' }]) expect(() => validateListInput(bad, user)).not.toThrow()
    expect(validateListInput(null, user).error).toBe('bad_request')
  })
})

describe('bio y mensajes', () => {
  it('bio sin links y con tope', () => {
    expect(validateBio('Amante del cine de terror').value).toBe('Amante del cine de terror')
    expect(validateBio('seguime en sitio.com').error).toBe('text_links')
    expect(validateBio('x'.repeat(400)).value).toHaveLength(LIMITS.bio)
  })
  it('todos los códigos tienen mensaje en español y hay uno por defecto', () => {
    for (const c of ['handle_taken', 'list_limit', 'forbidden', 'text_links', 'cannot_publish_yet']) expect(socialErrorMessage(c).length).toBeGreaterThan(10)
    expect(socialErrorMessage('xyz')).toMatch(/falló/)
  })
})
