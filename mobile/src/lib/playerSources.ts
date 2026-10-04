import type { MediaType } from '@/api/types'
import { getItem, setItem } from '@/lib/storage'

// Misma lista y mismas URLs que src/lib/playerSources.js de la web.
// En la app el embed corre dentro de un WebView, así que no hay atributo sandbox.
const EM_ID = 'yw2gr95fzq5ta5k0'

export interface Source {
  id: string
  label: string
  esLat?: boolean
  premium?: boolean
  movieUrl: (id: number | string) => string
  tvUrl: (id: number | string, season: number, episode: number) => string
}

export const SOURCES: Source[] = [
  {
    // Único servidor que fuerza el audio por URL (dub=es-LA).
    id: 'vidlink', label: 'VidLink', esLat: true,
    movieUrl: (id) => `https://vidlink.pro/movie/${id}?autoplay=true&dub=es-LA&primaryColor=E8A020`,
    tvUrl: (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true&dub=es-LA&primaryColor=E8A020`,
  },
  {
    id: 'vidsrccc', label: 'VidSrc.cc', esLat: true,
    movieUrl: (id) => `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true`,
    tvUrl: (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}?autoPlay=true`,
  },
  {
    // sub=es fuerza subtítulo en español por defecto; el audio no se puede forzar por URL.
    id: 'vidfast', label: 'VidFast', esLat: true,
    movieUrl: (id) => `https://vidfast.pro/movie/${id}?autoplay=true&sub=es`,
    tvUrl: (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}?autoplay=true&sub=es`,
  },
  {
    id: 'embedmaster', label: 'EmbedMaster', premium: true, esLat: true,
    movieUrl: (id) => `https://embedmaster.link/${EM_ID}/movie/${id}`,
    tvUrl: (id, s, e) => `https://embedmaster.link/${EM_ID}/tv/${id}/${s}/${e}`,
  },
  {
    id: '111movies', label: '111Movies', esLat: true,
    movieUrl: (id) => `https://111movies.com/movie/${id}`,
    tvUrl: (id, s, e) => `https://111movies.com/tv/${id}/${s}/${e}`,
  },
  {
    id: 'mapple', label: 'MappleTV', esLat: true,
    movieUrl: (id) => `https://mappletv.uk/watch/movie/${id}`,
    tvUrl: (id, s, e) => `https://mappletv.uk/watch/tv/${id}-${s}-${e}`,
  },
  {
    id: '2embed-skin', label: '2Embed+', esLat: true,
    movieUrl: (id) => `https://2embed.skin/embed/${id}`,
    tvUrl: (id, s, e) => `https://2embed.skin/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    id: 'vidsrcpm', label: 'VidSrc Pro',
    movieUrl: (id) => `https://vidsrc.pm/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://vidsrc.pm/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidsrc', label: 'VidSrc',
    movieUrl: (id) => `https://vidsrc.to/embed/movie/${id}`,
    tvUrl: (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
  },
  {
    id: 'vidsrcnet', label: 'VidSrc.net',
    movieUrl: (id) => `https://vidsrc.net/embed/movie/?tmdb=${id}`,
    tvUrl: (id, s, e) => `https://vidsrc.net/embed/tv/?tmdb=${id}&season=${s}&episode=${e}`,
  },
  {
    id: '2embed', label: '2Embed',
    movieUrl: (id) => `https://www.2embed.cc/embed/${id}`,
    tvUrl: (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
  },
  {
    id: 'multiembed', label: 'MultiEmbed',
    movieUrl: (id) => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl: (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
  },
]

// Servidores que en uso real más seguido traen pista latina — van siempre primero, en este orden.
export const LATAM_PRIORITY_IDS = ['vidlink', 'embedmaster', '111movies']

const STORAGE_KEY = 'repelis:lastSource:v1'

export const rememberSource = (id: string) => setItem(STORAGE_KEY, id)
export const loadRememberedSource = () => getItem(STORAGE_KEY)

export const getOrderedSources = (remembered?: string | null): Source[] => {
  let ordered = SOURCES
  if (remembered) {
    const idx = ordered.findIndex((s) => s.id === remembered)
    if (idx > 0) ordered = [ordered[idx], ...ordered.slice(0, idx), ...ordered.slice(idx + 1)]
  }
  const byId = new Map(ordered.map((s) => [s.id, s]))
  const priority = LATAM_PRIORITY_IDS.map((id) => byId.get(id)).filter((s): s is Source => !!s)
  const prioritySet = new Set(LATAM_PRIORITY_IDS)
  return [...priority, ...ordered.filter((s) => !prioritySet.has(s.id))]
}

export const buildUrl = (
  source: Source,
  { mediaType, id, season = 1, episode = 1 }: { mediaType: MediaType; id: number | string; season?: number; episode?: number },
): string => (mediaType === 'tv' ? source.tvUrl(id, season, episode) : source.movieUrl(id))

// HTML contenedor: replica el iframe de la web (mismo origen padre, sin referrer, permisos de pantalla completa).
export const PARENT_ORIGIN = 'https://repelis.vercel.app'

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// Puente WebView → React Native: avisa cuándo el iframe terminó de cargar y cuándo el reproductor emite play.
const BRIDGE_SCRIPT =
  '(function(){function post(m){if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(m)}' +
  'var f=document.querySelector("iframe");f.addEventListener("load",function(){post("loaded")});' +
  'window.addEventListener("message",function(e){var d=e.data;if(!d)return;var ev=d.event||d.type||d;' +
  'if(ev==="play"||ev==="playing"||ev==="started"||ev==="PLAYER_EVENT")post("playing")})})();'

export const buildEmbedHtml = (url: string): string =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">` +
  `<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>` +
  `<body><iframe src="${escapeAttr(url)}" allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *" allowfullscreen referrerpolicy="no-referrer"></iframe>` +
  `<script>${BRIDGE_SCRIPT}</script></body></html>`
