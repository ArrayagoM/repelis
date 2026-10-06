import { describe, it, expect } from 'vitest'
import { rmsLevel, nextSpeaking, closeAction, voiceErrorText, SPEAK_HOLD_MS, SPEAK_ON } from '../voice'

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
  it('según el código de cierre decide reintentar o mostrar el motivo', () => {
    expect(closeAction(1000)).toEqual({ retry: false, error: null })
    expect(closeAction(1006)).toEqual({ retry: true, error: null })          // caída o servidor despertando
    expect(closeAction(4001).error).toBe('voice_full')
    expect(closeAction(4002).error).toBe('voice_replaced')
    expect(closeAction(4003).error).toBe('voice_kicked')
    expect(closeAction(4008).retry).toBe(false)
  })
  it('todos los errores tienen texto en español', () => {
    for (const k of ['mic_denied', 'mic_missing', 'voice_unavailable', 'voice_full', 'voice_replaced', 'voice_kicked', 'voice_rate', 'voice_failed', 'unsupported']) expect(voiceErrorText(k).length).toBeGreaterThan(10)
    expect(voiceErrorText('cualquier_cosa')).toMatch(/conectar/)
  })
})
