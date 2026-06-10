import axios from 'axios'
import { track } from '../lib/errorMonitor'

// ─────────────────────────────────────────────────────────────────────────
// API de streams deportivos comunitarios (modelo Repelis para deportes).
// Fuente: streamed.su — API pública, sin auth, comunidad-mantenida.
// ─────────────────────────────────────────────────────────────────────────

const STREAMED_BASE = 'https://streamed.su/api'

const sapi = axios.create({
  baseURL: STREAMED_BASE,
  timeout: 6000,
})

sapi.interceptors.response.use(
  (r) => r,
  (err) => {
    track('streamed.su', err, { url: err.config?.url })
    return Promise.reject(err)
  },
)

// Partidos en vivo o próximos por categoría
export const getLiveMatches = () => sapi.get('/matches/live')
export const getFootballMatches = () => sapi.get('/matches/football')
export const getAllMatches = () => sapi.get('/matches/all')

// Para obtener los embeds de stream de un partido específico:
// streamed.su entrega array de sources, cada uno con streamNo
export const getMatchSources = (matchId) => sapi.get(`/matches/${matchId}/sources`)

// URL embed final del stream
export const buildStreamUrl = (source, streamNo = 1) =>
  `https://embedme.top/embed/${source}/${streamNo}`

// Categorías oficiales transmitidas legalmente en Argentina/LATAM
export const LEGAL_BROADCASTERS_AR = [
  {
    name: 'TV Pública',
    logo: '🇦🇷',
    url: 'https://www.tvpublica.com.ar/envivo',
    description: 'Transmisión oficial gratuita en Argentina',
  },
  {
    name: 'Telefe',
    logo: '📺',
    url: 'https://mitelefe.com/vivo',
    description: 'Mi Telefe - streaming legal gratis',
  },
  {
    name: 'DSports',
    logo: '⚽',
    url: 'https://dsports.com.ar',
    description: 'Cable / streaming pago con paquete',
  },
  {
    name: 'TyC Sports Play',
    logo: '🏆',
    url: 'https://www.tycsports.com/play',
    description: 'Algunos partidos gratis con registro',
  },
]
