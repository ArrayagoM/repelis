import { describe, it, expect } from 'vitest'
import { escShouldClose, nextUntried, emitsEvents, isPlayerSignal, loadTimeoutMs, silentTimeoutMs, ESC_GRACE_MS } from '../playerGuard'

describe('escShouldClose', () => {
  it('cierra con ESC normal', () => {
    expect(escShouldClose({ fullscreenActive: false, lastFullscreenChangeAt: 0, now: 5000 })).toBe(true)
  })
  it('no cierra mientras está en pantalla completa', () => {
    expect(escShouldClose({ fullscreenActive: true, now: 5000 })).toBe(false)
  })
  it('no cierra justo después de salir de pantalla completa', () => {
    expect(escShouldClose({ fullscreenActive: false, lastFullscreenChangeAt: 5000, now: 5000 + ESC_GRACE_MS - 1 })).toBe(false)
    expect(escShouldClose({ fullscreenActive: false, lastFullscreenChangeAt: 5000, now: 5000 + ESC_GRACE_MS + 1 })).toBe(true)
  })
})

describe('nextUntried', () => {
  it('avanza en orden circular saltando los ya probados', () => {
    expect(nextUntried(new Set([0]), 0, 4)).toBe(1)
    expect(nextUntried(new Set([0, 1]), 1, 4)).toBe(2)
    expect(nextUntried(new Set([2, 3]), 3, 4)).toBe(0)
    expect(nextUntried(new Set([3, 0]), 3, 4)).toBe(1)
  })
  it('devuelve -1 cuando ya se probaron todos', () => {
    expect(nextUntried(new Set([0, 1, 2]), 2, 3)).toBe(-1)
  })
  it('sin servidores devuelve -1', () => {
    expect(nextUntried(new Set(), 0, 0)).toBe(-1)
  })
})

describe('señales del reproductor', () => {
  it('reconoce los servidores que avisan lo que pasa', () => {
    expect(emitsEvents({ id: 'vidlink' })).toBe(true)
    expect(emitsEvents({ id: 'vidfast' })).toBe(true)
    expect(emitsEvents({ id: '2embed' })).toBe(false)
    expect(emitsEvents(null)).toBe(false)
  })
  it('detecta mensajes de reproducción', () => {
    expect(isPlayerSignal({ type: 'PLAYER_EVENT', data: { event: 'play' } })).toBe(true)
    expect(isPlayerSignal({ event: 'playing' })).toBe(true)
    expect(isPlayerSignal({ event: 'timeupdate' })).toBe(true)
  })
  it('ignora mensajes ajenos', () => {
    expect(isPlayerSignal(null)).toBe(false)
    expect(isPlayerSignal('hola')).toBe(false)
    expect(isPlayerSignal({ type: 'webpackOk' })).toBe(false)
  })
})

describe('esperas', () => {
  it('se alargan con una conexión lenta', () => {
    expect(loadTimeoutMs('good')).toBeLessThan(loadTimeoutMs('moderate'))
    expect(loadTimeoutMs('moderate')).toBeLessThan(loadTimeoutMs('slow'))
    expect(silentTimeoutMs('good')).toBeLessThan(silentTimeoutMs('slow'))
  })
})
