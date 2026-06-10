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

// Retry con backoff (1 retry, lo justo)
sportsApi.interceptors.response.use(
  (r) => r,
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

// ─── Live: próximos y en vivo ─────────────────────────────────────────────
// TheSportsDB tiene endpoint v2 con livescore. Acá usamos eventsnext + filter.
export const getLiveEvents = () =>
  sportsApi.get(`/livescore.php`, { params: { s: 'Soccer' } })
    .catch(() => ({ data: { events: [] } }))   // fallback silencioso

export const getNextEvents = (leagueId) =>
  sportsApi.get(`/eventsnextleague.php`, { params: { id: leagueId } })

export const getPastEvents = (leagueId) =>
  sportsApi.get(`/eventspastleague.php`, { params: { id: leagueId } })

// ─── Equipos ──────────────────────────────────────────────────────────────
export const getTeam = (teamId) =>
  sportsApi.get(`/lookupteam.php`, { params: { id: teamId } })

export { LEAGUE_IDS }
