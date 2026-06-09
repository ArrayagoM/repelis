import { describe, it, expect, beforeEach, vi } from 'vitest'
import { track, subscribe, clearErrors, getErrors } from '../errorMonitor'

describe('errorMonitor', () => {
  beforeEach(() => {
    clearErrors()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('track agrega un error con scope, message y timestamp', () => {
    track('test', new Error('boom'), { url: '/x' })
    const errs = getErrors()
    expect(errs).toHaveLength(1)
    expect(errs[0].scope).toBe('test')
    expect(errs[0].message).toBe('boom')
    expect(errs[0].meta.url).toBe('/x')
    expect(errs[0].ts).toBeGreaterThan(0)
  })

  it('track guarda máximo 20 errores (rotación FIFO)', () => {
    for (let i = 0; i < 25; i++) track('loop', `err-${i}`)
    expect(getErrors().length).toBe(20)
    // el más nuevo está primero
    expect(getErrors()[0].message).toBe('err-24')
  })

  it('subscribe recibe la lista actualizada', () => {
    const listener = vi.fn()
    const unsub = subscribe(listener)
    // Recibe sync el estado actual al suscribirse
    expect(listener).toHaveBeenCalledWith([])
    track('test', 'hola')
    expect(listener).toHaveBeenCalledTimes(2)
    expect(listener.mock.calls[1][0][0].message).toBe('hola')
    unsub()
  })

  it('clearErrors vacía la lista', () => {
    track('a', '1'); track('a', '2')
    expect(getErrors().length).toBe(2)
    clearErrors()
    expect(getErrors().length).toBe(0)
  })

  it('persiste en localStorage', () => {
    track('test', 'persisted')
    const raw = localStorage.getItem('repelis:errors:v1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw)
    expect(parsed[0].message).toBe('persisted')
  })
})
