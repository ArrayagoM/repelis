import axios from 'axios'
import { track } from '../lib/errorMonitor'

// ─────────────────────────────────────────────────────────────────────────
// API de datos deportivos — TheSportsDB (100% gratis, sin auth).
// Backup: football-data.org si TheSportsDB falla.
// ─────────────────────────────────────────────────────────────────────────

const SPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3'

// IDs oficiales de TheSportsDB
const LEAGUE_IDS = {
  WORLD_CUP_2026:    4429,   // FIFA World Cup
  EUROCOPA:          4502,
  COPA_AMERICA:      4480,
  CHAMPIONS_LEAGUE:  4480,
  PREMIER_LEAGUE:    4328,
  LA_LIGA:           4335,
  ARGENTINE_LEAGUE:  4406,
}

const sportsApi = axios.create({
  baseURL: SPORTSDB_BASE,
  timeout: 8000,
})

// La key gratis '3' es compartida y a veces devuelve una página HTML de error
// (rate-limit) en vez de JSON. axios no rechaza eso (status 200), así que lo
// detectamos: si data es string (HTML) o no tiene forma de objeto, es error.
const looksLikeHtml = (data) =>
  typeof data === 'string' && data.trim().startsWith('<')

// Retry con backoff. Reintenta ante error de red O ante respuesta HTML basura.
sportsApi.interceptors.response.use(
  async (res) => {
    if (looksLikeHtml(res.data)) {
      const cfg = res.config || {}
      if (!cfg.__retried) {
        cfg.__retried = true
        await new Promise((r) => setTimeout(r, 800))
        return sportsApi(cfg)
      }
      // Segundo intento también falló → devolvemos data vacía manejable
      track('sportsdb-html', new Error('HTML response'), { url: cfg.url })
      return { ...res, data: { events: null } }
    }
    return res
  },
  async (err) => {
    const cfg = err.config || {}
    if (cfg.__retried) {
      track('sportsdb', err, { url: cfg.url })
      return Promise.reject(err)
    }
    cfg.__retried = true
    await new Promise((r) => setTimeout(r, 600))
    return sportsApi(cfg)
  },
)

// ─── Fixture y eventos ────────────────────────────────────────────────────
export const getWorldCupFixture = (season = '2026') =>
  sportsApi.get(`/eventsseason.php`, { params: { id: LEAGUE_IDS.WORLD_CUP_2026, s: season } })

export const getLeagueEvents = (leagueId, season) =>
  sportsApi.get(`/eventsseason.php`, { params: { id: leagueId, s: season } })

export const getEventDetail = (eventId) =>
  sportsApi.get(`/lookupevent.php`, { params: { id: eventId } })

export const getEventLineups = (eventId) =>
  sportsApi.get(`/lookuplineup.php`, { params: { id: eventId } })

export const getEventStats = (eventId) =>
  sportsApi.get(`/lookupeventstats.php`, { params: { id: eventId } })

// ─── Estado de un partido derivado de sus datos ───────────────────────────
// El endpoint /livescore.php NO funciona con la key gratis (devuelve HTML).
// En vez de depender de él, calculamos el estado desde el fixture:
//   - 'finished' : strStatus === 'FT'/'AET'/'PEN' o timestamp + 2.5h pasado
//   - 'live'     : ahora está entre kickoff y kickoff + 2.5h
//   - 'upcoming' : kickoff en el futuro
const MATCH_DURATION_MS = 2.5 * 60 * 60 * 1000

// TheSportsDB entrega timestamps en UTC pero SIN sufijo 'Z'. new Date() los
// parsearía como hora local → error de varias horas. Forzamos UTC.
const toUtcMs = (ts) => {
  if (!ts) return NaN
  const hasTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(ts)
  return new Date(hasTz ? ts : `${ts}Z`).getTime()
}

export const getMatchStatus = (ev) => {
  const status = (ev.strStatus || '').toUpperCase()
  if (['FT', 'AET', 'PEN', 'MATCH FINISHED'].includes(status)) return 'finished'

  const ts = ev.strTimestamp || (ev.dateEvent ? `${ev.dateEvent}T${ev.strTime || '00:00:00'}` : null)
  if (!ts) return 'upcoming'
  const kickoff = toUtcMs(ts)
  if (Number.isNaN(kickoff)) return 'upcoming'

  const now = Date.now()
  if (now < kickoff) return 'upcoming'
  if (now < kickoff + MATCH_DURATION_MS) return 'live'
  return 'finished'
}

// Filtra los partidos EN VIVO de un fixture ya cargado (sin llamada extra).
export const getLiveFromFixture = (fixture = []) =>
  fixture.filter((ev) => getMatchStatus(ev) === 'live')

export const getNextEvents = (leagueId) =>
  sportsApi.get(`/eventsnextleague.php`, { params: { id: leagueId } })

export const getPastEvents = (leagueId) =>
  sportsApi.get(`/eventspastleague.php`, { params: { id: leagueId } })

// ─── Equipos ──────────────────────────────────────────────────────────────
export const getTeam = (teamId) =>
  sportsApi.get(`/lookupteam.php`, { params: { id: teamId } })

export { LEAGUE_IDS }
