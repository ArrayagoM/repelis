// ─── EmbedMaster Player ID ────────────────────────────────────────────────
const EM_ID = 'yw2gr95fzq5ta5k0'

/**
 * SOURCES está ORDENADA por afinidad con audio español latino.
 * Los primeros 5 son los que mejor cumplen con doblaje LATAM:
 *   1. EmbedMaster — multi-idioma con pistas latinas curadas (premium).
 *   2. VidLink     — acepta lang=es y suele tener LATAM por default.
 *   3. AutoEmbed   — acepta lang=es, base de datos amplia.
 *   4. VidFast     — acepta lang=es.
 *   5. SmashyStream — buen catálogo LATAM.
 *
 * El resto va de respaldo. La lista no es estática: si un server "X" funciona
 * para un usuario, queda recordado en localStorage y arranca por ese la próxima vez.
 *
 * ⚠️  EmbedMaster NO acepta sandbox — si se lo ponés, el player no carga.
 */
export const SOURCES = [
  {
    id: 'embedmaster', label: 'EmbedMaster', premium: true, esLat: true,
    movieUrl: (id)       => `https://embedmaster.link/${EM_ID}/movie/${id}`,
    tvUrl:    (id, s, e) => `https://embedmaster.link/${EM_ID}/tv/${id}/${s}/${e}`,
    sandbox: null,
    allowAttr: 'autoplay *; fullscreen *; picture-in-picture *; encrypted-media *',
  },
  {
    id: 'vidlink', label: 'VidLink', esLat: true,
    // VidLink SÍ respeta dub=es-LA documentadamente. Lo dejamos.
    movieUrl: (id)       => `https://vidlink.pro/movie/${id}?autoplay=true&dub=es-LA&primaryColor=E8A020`,
    tvUrl:    (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true&dub=es-LA&primaryColor=E8A020`,
    sandbox: null,
  },
  {
    id: 'autoembed', label: 'AutoEmbed', esLat: true,
    // AutoEmbed: lang=es documentado, audio=spanish NO documentado (lo sacamos).
    movieUrl: (id)       => `https://player.autoembed.cc/embed/movie/${id}?lang=es`,
    tvUrl:    (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}?lang=es`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'vidfast', label: 'VidFast', esLat: true,
    // VidFast acepta autoplay, el resto de params estaban inventados.
    movieUrl: (id)       => `https://vidfast.pro/movie/${id}?autoplay=true`,
    tvUrl:    (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}?autoplay=true`,
    sandbox: null,
  },
  {
    id: 'smashy', label: 'SmashyStream', esLat: true,
    // SmashyStream maneja idiomas internamente, los params no le hacen efecto.
    movieUrl: (id)       => `https://player.smashy.stream/movie/${id}`,
    tvUrl:    (id, s, e) => `https://player.smashy.stream/tv/${id}?s=${s}&e=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'rivestream', label: 'RiveStream', esLat: true,
    movieUrl: (id)       => `https://rivestream.live/embed?type=movie&id=${id}`,
    tvUrl:    (id, s, e) => `https://rivestream.live/embed?type=tv&id=${id}&season=${s}&episode=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'moviesapi', label: 'MoviesAPI', esLat: true,
    movieUrl: (id)       => `https://moviesapi.club/movie/${id}`,
    tvUrl:    (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: '111movies', label: '111Movies', esLat: true,
    movieUrl: (id)       => `https://111movies.com/movie/${id}`,
    tvUrl:    (id, s, e) => `https://111movies.com/tv/${id}/${s}/${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'mapple', label: 'MappleTV', esLat: true,
    movieUrl: (id)       => `https://mappletv.uk/watch/movie/${id}`,
    tvUrl:    (id, s, e) => `https://mappletv.uk/watch/tv/${id}-${s}-${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'multiembed', label: 'MultiEmbed',
    // MultiEmbed no documenta param de idioma, lo sacamos.
    movieUrl: (id)       => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl:    (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
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
    id: 'vidsrc', label: 'VidSrc',
    movieUrl: (id)       => `https://vidsrc.to/embed/movie/${id}`,
    tvUrl:    (id, s, e) => `https://vidsrc.to/embed/tv/${id}/${s}/${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'vidsrcxyz', label: 'VidSrc.xyz',
    movieUrl: (id)       => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
    tvUrl:    (id, s, e) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
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
    id: '2embed-skin', label: '2Embed+', esLat: true,
    movieUrl: (id)       => `https://2embed.skin/embed/${id}`,
    tvUrl:    (id, s, e) => `https://2embed.skin/embedtv/${id}&s=${s}&e=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
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
 * Devuelve SOURCES con orden compuesto:
 *   1. Si tenemos ranking de velocidad medido (speedTest cache) → lo usamos.
 *   2. Caso contrario → orden estático por afinidad LATAM.
 *   3. Sobre cualquiera, el último que funcionó para el usuario va al frente.
 *
 * Importante: cargamos el ranking en forma perezosa para evitar dependencia
 * circular con speedTest.js.
 */
export const getOrderedSources = () => {
  const remembered = safeGet()

  // Carga perezosa del ranking
  let ordered = SOURCES
  try {
    const raw = localStorage.getItem('repelis:speed:v1')
    if (raw) {
      const { ts, ranking } = JSON.parse(raw)
      const fresh = ts && Date.now() - ts < 6 * 60 * 60 * 1000
      if (fresh && Array.isArray(ranking)) {
        const byId = new Map(SOURCES.map((s) => [s.id, s]))
        const rankedIds = new Set(ranking.map((r) => r.id))
        // 1) Mejores latinos del ranking primero
        const latinos = ranking.filter((r) => r.ok && byId.get(r.id)?.esLat).map((r) => byId.get(r.id))
        // 2) Resto del ranking (no-latinos pero ok)
        const others  = ranking.filter((r) => r.ok && !byId.get(r.id)?.esLat).map((r) => byId.get(r.id))
        // 3) Los que fallaron en la medición, al final
        const failed  = ranking.filter((r) => !r.ok).map((r) => byId.get(r.id))
        // 4) Cualquiera no medido aún
        const unmeasured = SOURCES.filter((s) => !rankedIds.has(s.id))
        ordered = [...latinos, ...others, ...unmeasured, ...failed].filter(Boolean)
      }
    }
  } catch {}

  // El último servidor que funcionó al frente
  if (remembered) {
    const idx = ordered.findIndex((s) => s.id === remembered)
    if (idx > 0) ordered = [ordered[idx], ...ordered.slice(0, idx), ...ordered.slice(idx + 1)]
  }

  return ordered
}

export const buildUrl = (source, { mediaType, id, season = 1, episode = 1 }) => {
  if (!source || !id) return ''
  return mediaType === 'tv' ? source.tvUrl(id, season, episode) : source.movieUrl(id)
}
