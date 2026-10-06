import { describe, it, expect } from 'vitest'
import { rmsLevel, nextSpeaking, shouldInitiate, signalDelay, voiceErrorText, SPEAK_HOLD_MS, SPEAK_ON, SIGNAL_FAST_MS, SIGNAL_SLOW_MS } from '../voice'

describe('voz: piezas puras', () => {
  it('calcula el nivel de audio (silencio vs. voz)', () => {
    expect(rmsLevel(new Uint8Array(256).fill(128))).toBe(0)
    expect(rmsLevel(new Uint8Array([]))).toBe(0)
    expect(rmsLevel(Uint8Array.from({ length: 256 }, (_, i) => (i % 2 ? 228 : 28)))).toBeGreaterThan(0.5)
  })
  it('"hablando" se enciende rápido y se apaga con un pequeño retardo (sin parpadear)', () => {
    let s = { speaking: false, until: 0 }
    s = nextSpeaking(s, SPEAK_ON + 0.1, 1000); expect(s.speaking).toBe(true)
    s = nextSpeaking(s, 0, 1000 + SPEAK_HOLD_MS - 10); expect(s.speaking).toBe(true)      // todavía dentro de la espera
    s = nextSpeaking(s, 0, 1000 + SPEAK_HOLD_MS + 10); expect(s.speaking).toBe(false)
    expect(nextSpeaking({ speaking: false, until: 0 }, 0.001, 5)).toEqual({ speaking: false, until: 0 })
  })
  it('siempre llama la persona que entró después (nunca se cruzan dos ofertas)', () => {
    expect(shouldInitiate(200, 100, 'bea', 'ana')).toBe(true)
    expect(shouldInitiate(100, 200, 'ana', 'bea')).toBe(false)
    // empate exacto: decide el @usuario, y exactamente una de las dos llama
    expect(shouldInitiate(100, 100, 'bea', 'ana')).toBe(true)
    expect(shouldInitiate(100, 100, 'ana', 'bea')).toBe(false)
  })
  it('consulta señales rápido mientras conecta y lento cuando está estable', () => {
    expect(signalDelay({ negotiating: true, recentChange: false })).toBe(SIGNAL_FAST_MS)
    expect(signalDelay({ negotiating: false, recentChange: true })).toBe(SIGNAL_FAST_MS)
    expect(signalDelay({ negotiating: false, recentChange: false })).toBe(SIGNAL_SLOW_MS)
  })
  it('todos los errores tienen texto en español', () => {
    for (const k of ['mic_denied', 'mic_missing', 'voice_unavailable', 'kicked', 'room_closed', 'voice_failed', 'unsupported']) expect(voiceErrorText(k).length).toBeGreaterThan(10)
    expect(voiceErrorText('cualquier_cosa')).toMatch(/conectar/)
  })
})
