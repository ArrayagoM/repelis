// Datos de DEMOSTRACIÓN para el panel en desarrollo local (memoria; no existe en producción).
// Usa el mismo código de recepción que producción, con un reloj simulado: 7 días de tráfico inventado.
import { createPulse } from '../api/_lib/pulse.js'

const TITLES = [
  ['movie:603', 'Matrix'], ['tv:1396', 'Breaking Bad'], ['movie:27205', 'Origen'], ['movie:550', 'El club de la pelea'],
  ['tv:94605', 'Arcane'], ['movie:680', 'Pulp Fiction'], ['tv:66732', 'Stranger Things'], ['movie:1423191', 'Resident Evil: Noche cero'],
]
const COUNTRIES = ['AR', 'AR', 'AR', 'MX', 'CL', 'CO', 'UY', 'ES', 'PE']
const PLATS = ['web', 'web', 'pwa', 'pwa', 'tv', 'desktop-app', 'android-app']
const UAS = [
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120 Safari/537.36',
]

// Generador pseudoaleatorio determinista (siempre los mismos datos de demo)
const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }

export const seedDemoStats = async ({ stats, now = Date.now() }) => {
  const rand = rng(42)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  let clock = now
  const pulse = createPulse({ stats, now: () => clock })
  const send = (body, country, ua) => pulse({ body, headers: { 'x-vercel-ip-country': country, 'user-agent': ua } })

  for (let back = 6; back >= 0; back--) {
    const base = now - back * 86400000
    const visitors = 18 + Math.floor(rand() * 30) + (6 - back) * 3
    for (let v = 0; v < visitors; v++) {
      const sid = `demo-${back}-${String(v).padStart(10, '0')}-sid`
      const country = pick(COUNTRIES)
      const ua = pick(UAS)
      const plat = pick(PLATS)
      const member = rand() < 0.35
      const hour = 11 + Math.floor(rand() * 12)                         // se conectan entre las 11 y las 23
      clock = base - (new Date(base).getUTCHours() - 3 - hour) * 3600000
      if (clock > now) clock = now - 1000 * (v + 1)
      await send({ k: 'hb', sid, page: 'home', nav: true, member, plat }, country, ua)
      const watches = rand() < 0.62
      const [key, title] = pick(TITLES)
      const beats = watches ? 2 + Math.floor(rand() * 40) : 1 + Math.floor(rand() * 3)
      for (let b = 0; b < beats; b++) {
        clock += 30_000
        if (clock > now) break
        await send({ k: 'hb', sid, page: watches ? 'movie' : 'catalog', nav: b === 0, member, plat, ...(watches ? { w: { key, title } } : {}) }, country, ua)
      }
      if (rand() < 0.2) await send({ k: 'ev', sid, name: member ? 'login' : 'gate_shown_watch' }, country, ua)
      if (rand() < 0.07) await send({ k: 'ev', sid, name: 'signup_gate' }, country, ua)
      if (rand() < 0.12) await send({ k: 'ev', sid, name: 'donate_shown' }, country, ua)
    }
  }
  clock = now
}
