// Puente hacia el servidor de voz (voice-server/, en Railway). Ese servidor NO está siempre prendido: la plataforma lo duerme
// cuando no hay conexiones y lo despierta al recibir un pedido. Por eso al CREAR una sala (y al pedir un token) lo "despertamos"
// de antemano con un /health, así está listo cuando la gente entra a hablar.
//
// Variables en Vercel: VOICE_URL (wss://…) y VOICE_SECRET (el mismo que tiene el servidor de voz). Sin ellas, no hay voz (el resto sigue igual).
import { signToken } from '../../voice-server/lib.js'

const httpBase = (url) => url.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/+$/, '')

/** @returns {null | { url, token, warm, kick }} */
export const createVoice = (env = process.env, fetchImpl = fetch) => {
  const url = String(env.VOICE_URL || '').trim()
  const secret = String(env.VOICE_SECRET || '')
  if (!/^wss?:\/\//i.test(url) || secret.length < 16) return null
  const base = httpBase(url)
  const wsUrl = `${url.replace(/\/+$/, '')}/ws`

  const timed = async (path, init = {}, ms = 2500) => {
    const ctl = new AbortController()
    const t = setTimeout(() => ctl.abort(), ms)
    try { return await fetchImpl(`${base}${path}`, { ...init, signal: ctl.signal }) } catch { return null } finally { clearTimeout(t) }
  }

  return {
    url: wsUrl,
    /** Token de 5 min para abrir la conexión de voz de UNA persona en UNA sala. */
    token: ({ userId, handle, name, code }, now = Date.now()) => signToken({ sub: String(userId), handle, name, code }, secret, now),
    /** Despierta el servidor (si está dormido). Se espera como máximo ~2,5 s (en Vercel un pedido sin esperar se corta al responder); el despertar sigue aunque se corte la espera. */
    warm: () => timed('/health'),
    /** Saca a una persona de la voz de una sala, o a todas (`all: true`). Best-effort. */
    kick: ({ code, userId, all = false }) => timed('/kick', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-voice-secret': secret }, body: JSON.stringify({ code, userId, all }),
    }),
  }
}
