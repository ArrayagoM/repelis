// ─── EmbedMaster Player ID ────────────────────────────────────────────────
const EM_ID = 'yw2gr95fzq5ta5k0'

// ⚠️  EmbedMaster NO acepta sandbox — si se lo ponés el player no carga.
export const SOURCES = [
  {
    id: 'embedmaster', label: 'EmbedMaster', premium: true,
    movieUrl: (id)       => `https://embedmaster.link/${EM_ID}/movie/${id}`,
    tvUrl:    (id, s, e) => `https://embedmaster.link/${EM_ID}/tv/${id}/${s}/${e}`,
    sandbox: null,
    allowAttr: 'autoplay *; fullscreen *; picture-in-picture *; encrypted-media *',
  },
  {
    id: 'vidsrc', label: 'VidSrc',
    movieUrl: (id)       => `https://vidsrc.to/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'vidsrcicu', label: 'VidSrc+',
    movieUrl: (id)       => `https://vidsrc.icu/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'vidsrcpm', label: 'VidSrc Pro',
    movieUrl: (id)       => `https://vidsrc.pm/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://vidsrc.pm/embed/tv/${id}/${s}/${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'vidsrcxyz', label: 'VidSrc.xyz',
    movieUrl: (id)       => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
    tvUrl:    (id, s, e) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'vidlink', label: 'VidLink',
    movieUrl: (id)       => `https://vidlink.pro/movie/${id}?autoplay=true&lang=es&primaryColor=E8A020`,
    tvUrl:    (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true&lang=es&primaryColor=E8A020`,
    sandbox: null,
  },
  {
    id: 'smashy', label: 'SmashyStream',
    movieUrl: (id)       => `https://player.smashy.stream/movie/${id}`,
    tvUrl:    (id, s, e) => `https://player.smashy.stream/tv/${id}?s=${s}&e=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'multiembed', label: 'MultiEmbed',
    movieUrl: (id)       => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl:    (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'autoembed', label: 'AutoEmbed',
    movieUrl: (id)       => `https://player.autoembed.cc/embed/movie/${id}?lang=es`,
    tvUrl:    (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}?lang=es`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'embedsu', label: 'EmbedSU',
    movieUrl: (id)       => `https://embed.su/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: '2embed', label: '2Embed',
    movieUrl: (id)       => `https://www.2embed.cc/embed/${id}`,
    tvUrl:    (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'vidfast', label: 'VidFast',
    movieUrl: (id)       => `https://vidfast.pro/movie/${id}?autoplay=true`,
    tvUrl:    (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}?autoplay=true`,
    sandbox: null,
  },
]

export const DEFAULT_ALLOW =
  'autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope'

// ─── Memoria de último servidor exitoso ──────────────────────────────────
const STORAGE_KEY = 'repelis:lastSource:v1'

const safeGet = () => { try { return localStorage.getItem(STORAGE_KEY) } catch (_) { return null } }
const safeSet = (v) => { try { localStorage.setItem(STORAGE_KEY, v) } catch (_) {} }

export const rememberSource = (sourceId) => { if (sourceId) safeSet(sourceId) }

/**
 * Devuelve SOURCES con el último que funcionó al frente.
 * Así el primer iframe que se monta es el que históricamente anduvo,
 * lo que reduce drásticamente el time-to-play.
 */
export const getOrderedSources = () => {
  const remembered = safeGet()
  if (!remembered) return SOURCES
  const idx = SOURCES.findIndex((s) => s.id === remembered)
  if (idx <= 0) return SOURCES
  return [SOURCES[idx], ...SOURCES.slice(0, idx), ...SOURCES.slice(idx + 1)]
}

export const buildUrl = (source, { mediaType, id, season = 1, episode = 1 }) => {
  if (!source || !id) return ''
  return mediaType === 'tv' ? source.tvUrl(id, season, episode) : source.movieUrl(id)
}
