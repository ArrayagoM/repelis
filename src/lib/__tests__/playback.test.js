import { describe, it, expect, beforeEach } from 'vitest'
import { parsePlayerMessage, reportPlayerEvent, clearPlayback, getPlayback, currentPosition, positionForSync, referenceTime, advise, formatClock, countdownSeconds, TOLERANCE_S } from '../playback'

beforeEach(() => clearPlayback())

describe('mensajes de los reproductores', () => {
  it('entiende el formato PLAYER_EVENT (VidLink) y los sueltos', () => {
    expect(parsePlayerMessage({ type: 'PLAYER_EVENT', data: { event: 'timeupdate', currentTime: 12.5, duration: 8180 } })).toEqual({ event: 'timeupdate', t: 12.5, duration: 8180 })
    expect(parsePlayerMessage(JSON.stringify({ type: 'PLAYER_EVENT', data: { event: 'play', currentTime: 0 } }))).toMatchObject({ event: 'play', t: 0 })
    expect(parsePlayerMessage({ event: 'pause', currentTime: 33 })).toMatchObject({ event: 'pause', t: 33 })
  })
  it('ignora todo lo que no es de reproducción o viene con datos raros', () => {
    for (const bad of [null, undefined, 5, 'hola', '{roto', { type: 'MEDIA_DATA', data: {} }, { type: 'sr' }, { event: 'timeupdate', currentTime: -1 }, { event: 'timeupdate', currentTime: 'x' }, { event: 'timeupdate', currentTime: 1e9 }, { type: 'PLAYER_EVENT', data: { event: 'otro', currentTime: 3 } }]) {
      expect(parsePlayerMessage(bad)).toBeNull()
    }
  })
  it('mantiene el estado: reproduciendo, pausado y limpiar', () => {
    expect(getPlayback().supported).toBe(false)
    reportPlayerEvent({ type: 'PLAYER_EVENT', data: { event: 'play', currentTime: 10, duration: 100 } }, 1000)
    expect(getPlayback()).toMatchObject({ supported: true, t: 10, playing: true, duration: 100, at: 1000 })
    reportPlayerEvent({ event: 'pause', currentTime: 20 }, 2000)
    expect(getPlayback()).toMatchObject({ t: 20, playing: false })
    reportPlayerEvent({ event: 'timeupdate', currentTime: 21 }, 3000)
    expect(getPlayback().playing).toBe(true)
    expect(reportPlayerEvent({ type: 'sr' })).toBe(false)
    clearPlayback()
    expect(getPlayback().supported).toBe(false)
  })
})

describe('posición y consejo', () => {
  it('estima el minuto entre mensajes y no inventa si dejó de informar', () => {
    const pb = { supported: true, t: 100, playing: true, at: 10_000, duration: 0 }
    expect(currentPosition(pb, 12_000)).toBeCloseTo(102)
    expect(currentPosition(pb, 10_000 + 7000)).toBeNull()
    expect(currentPosition({ ...pb, playing: false }, 99_000)).toBe(100)
    expect(currentPosition({ supported: false }, 0)).toBeNull()
    expect(positionForSync(pb, 11_000)).toEqual({ t: 101, playing: true })
    expect(positionForSync({ supported: false })).toBeNull()
  })
  it('el tiempo de referencia avanza si el anfitrión está reproduciendo', () => {
    expect(referenceTime({ t: 600, playing: true, at: 1000 }, 4000)).toBe(603)
    expect(referenceTime({ t: 600, playing: false, at: 1000 }, 9000)).toBe(600)
    expect(referenceTime(null, 1)).toBeNull()
    expect(referenceTime({ t: 5, playing: true, at: 9000 }, 8000)).toBe(5)           // reloj desfasado: nunca retrocede
  })
  it('aconseja según cuánto se adelantó o atrasó', () => {
    expect(advise(100, 100 + TOLERANCE_S)).toEqual({ kind: 'ok' })
    expect(advise(110, 100)).toEqual({ kind: 'ahead', seconds: 10 })
    expect(advise(90, 100)).toEqual({ kind: 'behind', seconds: 10, target: 100 })
    expect(advise(null, 100)).toBeNull(); expect(advise(100, null)).toBeNull()
  })
  it('formatea el reloj y la cuenta regresiva', () => {
    expect(formatClock(75)).toBe('1:15'); expect(formatClock(4325)).toBe('1:12:05'); expect(formatClock(-3)).toBe('0:00')
    expect(countdownSeconds(10_000, 7_400)).toBe(3); expect(countdownSeconds(10_000, 10_000)).toBe(0); expect(countdownSeconds(10_000, 11_000)).toBe(-1)
  })
})
