// ─── EmbedMaster Player ID ────────────────────────────────────────────────
const EM_ID = 'yw2gr95fzq5ta5k0'

/**
 * SOURCES ordenada por: vivos primero (uptime real verificado), después
 * priorizamos esLat=true. Los servidores que dieron 404/timeout en pruebas
 * de producción están comentados — los reactivamos si vuelven.
 *
 * Audio en español automático — IMPORTANTE (ver LATAM_PRIORITY_IDS más abajo):
 * ninguno de estos embeds tiene el mismo catálogo de doblaje. Confiar en un
 * solo servidor (aunque acepte un parámetro que "fuerza" el idioma) deja
 * afuera títulos que SÍ tienen audio latino pero solo en otro servidor de
 * la lista. Por eso no alcanza con forzar un parámetro de URL: hay que
 * intentar automáticamente, en orden fijo, los servidores que en uso real
 * (no documentación) más seguido traen pista latina — VidLink, EmbedMaster
 * y 111Movies — antes de caer al resto. VidLink además acepta `dub=es-LA`
 * por URL (el único de los tres que lo hace), VidFast solo permite forzar
 * el idioma de los SUBTÍTULOS (`sub=es`), no el audio.
 *
 * Última verificación: 2026-09-07 (revisión en vivo de cada dominio).
 * RiveStream se removió: su dominio está redirigiendo a una cadena de scam
 * ("hacé click en Permitir" / falso captcha de notificaciones) — riesgo real
 * para el usuario, no relacionado a idioma. Reactivar sólo si limpian esto.
 *
 * ⚠️  EmbedMaster NO acepta sandbox — si se lo ponés, el player no carga.
 */
export const SOURCES = [
  // ─── Top tier: esLat + OK ─────────────────────────────────────────────
  {
    // Único servidor que fuerza el audio por URL (dub=es-LA). Además está
    // en LATAM_PRIORITY_IDS (ver getOrderedSources), así que va siempre
    // primero sin importar velocidad medida ni "recordado".
    id: 'vidlink', label: 'VidLink', esLat: true, forceDub: true,
    movieUrl: (id)       => `https://vidlink.pro/movie/${id}?autoplay=true&dub=es-LA&primaryColor=E8A020`,
    tvUrl:    (id, s, e) => `https://vidlink.pro/tv/${id}/${s}/${e}?autoplay=true&dub=es-LA&primaryColor=E8A020`,
    sandbox: null,
  },
  {
    // VidSrc.cc tiene selector de idioma/audio con opciones LATAM en su player.
    id: 'vidsrccc', label: 'VidSrc.cc', esLat: true,
    movieUrl: (id)       => `https://vidsrc.cc/v2/embed/movie/${id}?autoPlay=true`,
    tvUrl:    (id, s, e) => `https://vidsrc.cc/v2/embed/tv/${id}/${s}/${e}?autoPlay=true`,
    sandbox: null,
  },
  {
    // sub=es fuerza subtítulo en español por defecto (documentado). El audio
    // en sí no se puede forzar por URL en este servidor.
    id: 'vidfast', label: 'VidFast', esLat: true,
    movieUrl: (id)       => `https://vidfast.pro/movie/${id}?autoplay=true&sub=es`,
    tvUrl:    (id, s, e) => `https://vidfast.pro/tv/${id}/${s}/${e}?autoplay=true&sub=es`,
    sandbox: null,
  },
  {
    id: 'embedmaster', label: 'EmbedMaster', premium: true, esLat: true,
    movieUrl: (id)       => `https://embedmaster.link/${EM_ID}/movie/${id}`,
    tvUrl:    (id, s, e) => `https://embedmaster.link/${EM_ID}/tv/${id}/${s}/${e}`,
    sandbox: null,
    allowAttr: 'autoplay *; fullscreen *; picture-in-picture *; encrypted-media *',
  },
  {
    // Verificado en vivo 2026-09-07: con sandbox tira "This site broke the
    // player" (rechaza el atributo). Igual que EmbedMaster/2Embed+.
    id: '111movies', label: '111Movies', esLat: true,
    movieUrl: (id)       => `https://111movies.com/movie/${id}`,
    tvUrl:    (id, s, e) => `https://111movies.com/tv/${id}/${s}/${e}`,
    sandbox: null,
  },
  {
    // Verificado en vivo 2026-09-07: con sandbox tira "Sandbox Detected"
    // y no carga nada. Igual que EmbedMaster/2Embed+/111Movies.
    id: 'mapple', label: 'MappleTV', esLat: true,
    movieUrl: (id)       => `https://mappletv.uk/watch/movie/${id}`,
    tvUrl:    (id, s, e) => `https://mappletv.uk/watch/tv/${id}-${s}-${e}`,
    sandbox: null,
  },
  {
    id: '2embed-skin', label: '2Embed+', esLat: true,
    movieUrl: (id)       => `https://2embed.skin/embed/${id}`,
    tvUrl:    (id, s, e) => `https://2embed.skin/embedtv/${id}&s=${s}&e=${e}`,
    // 2Embed+ rechaza explícitamente el sandbox attribute en el iframe
    // ("Sandbox not allowed" en la pantalla del player). Igual que EmbedMaster.
    sandbox: null,
  },
  // ─── Backup: rápidos pero sin garantía de LATAM ───────────────────────
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
    id: 'vidsrcnet', label: 'VidSrc.net',
    movieUrl: (id)       => `https://vidsrc.net/embed/movie/?tmdb=${id}`,
    tvUrl:    (id, s, e) => `https://vidsrc.net/embed/tv/?tmdb=${id}&season=${s}&episode=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: '2embed', label: '2Embed',
    movieUrl: (id)       => `https://www.2embed.cc/embed/${id}`,
    tvUrl:    (id, s, e) => `https://www.2embed.cc/embedtv/${id}&s=${s}&e=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },
  {
    id: 'multiembed', label: 'MultiEmbed',
    movieUrl: (id)       => `https://multiembed.mov/?video_id=${id}&tmdb=1`,
    tvUrl:    (id, s, e) => `https://multiembed.mov/?video_id=${id}&tmdb=1&s=${s}&e=${e}`,
    sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  },

  // ─── Caídos en última verificación (comentados, reactivar si vuelven) ─
  // {
  //   id: 'autoembed', label: 'AutoEmbed', esLat: true,
  //   movieUrl: (id)       => `https://player.autoembed.cc/embed/movie/${id}?lang=es`,
  //   tvUrl:    (id, s, e) => `https://player.autoembed.cc/embed/tv/${id}/${s}/${e}?lang=es`,
  //   sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  // },
  // {
  //   id: 'smashy', label: 'SmashyStream', esLat: true,
  //   movieUrl: (id)       => `https://player.smashy.stream/movie/${id}`,
  //   tvUrl:    (id, s, e) => `https://player.smashy.stream/tv/${id}?s=${s}&e=${e}`,
  //   sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  // },
  // {
  //   id: 'moviesapi', label: 'MoviesAPI', esLat: true,
  //   movieUrl: (id)       => `https://moviesapi.club/movie/${id}`,
  //   tvUrl:    (id, s, e) => `https://moviesapi.club/tv/${id}-${s}-${e}`,
  //   sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  // },
  // {
  //   id: 'vidsrcicu', label: 'VidSrc+',
  //   movieUrl: (id)       => `https://vidsrc.icu/embed/movie/${id}`,
  //   tvUrl:    (id, s, e) => `https://vidsrc.icu/embed/tv/${id}/${s}/${e}`,
  //   sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  // },
  // {
  //   id: 'vidsrcxyz', label: 'VidSrc.xyz',
  //   movieUrl: (id)       => `https://vidsrc.xyz/embed/movie?tmdb=${id}`,
  //   tvUrl:    (id, s, e) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${s}&episode=${e}`,
  //   sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  // },
  // {
  //   id: 'embedsu', label: 'EmbedSU',
  //   movieUrl: (id)       => `https://embed.su/embed/movie/${id}`,
  //   tvUrl:    (id, s, e) => `https://embed.su/embed/tv/${id}/${s}/${e}`,
  //   sandbox: 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation',
  // },
]

export const DEFAULT_ALLOW =
  'autoplay; fullscreen; picture-in-picture; encrypted-media; accelerometer; gyroscope'

// ─── Memoria de último servidor exitoso ──────────────────────────────────
const STORAGE_KEY = 'repelis:lastSource:v1'

const safeGet = () => { try { return localStorage.getItem(STORAGE_KEY) } catch (_) { return null } }
const safeSet = (v) => { try { localStorage.setItem(STORAGE_KEY, v) } catch (_) {} }

export const rememberSource = (sourceId) => { if (sourceId) safeSet(sourceId) }

// Servidores que en uso real (no en documentación) más seguido traen pista
// de audio latino, en el orden en que conviene probarlos. VidLink primero
// porque además fuerza dub=es-LA por URL; EmbedMaster y 111Movies quedan
// atrás pero SIEMPRE antes que el resto, sin importar velocidad ni
// "recordado" — depender de un solo servidor deja afuera títulos que sí
// tienen doblaje pero solo en otro de estos tres.
export const LATAM_PRIORITY_IDS = ['vidlink', 'embedmaster', '111movies']

/**
 * Devuelve SOURCES con orden compuesto:
 *   1. Si tenemos ranking de velocidad medido (speedTest cache) → lo usamos.
 *   2. Caso contrario → orden estático por afinidad LATAM.
 *   3. Sobre cualquiera, el último que funcionó para el usuario va al frente.
 *   4. Por último, LATAM_PRIORITY_IDS se manda SIEMPRE al principio de todo,
 *      en ese orden fijo. Esto es a propósito: ni la velocidad medida ni el
 *      "recordado" garantizan audio en español — probar automáticamente los
 *      tres servidores con mejor catálogo de doblaje conocido, antes que
 *      cualquier otra cosa, es lo que de verdad mueve la aguja.
 */
export const getOrderedSources = () => {
  const remembered = safeGet()

  let ordered = SOURCES
  try {
    const raw = localStorage.getItem('repelis:speed:v1')
    if (raw) {
      const { ts, ranking } = JSON.parse(raw)
      const fresh = ts && Date.now() - ts < 6 * 60 * 60 * 1000
      if (fresh && Array.isArray(ranking)) {
        const byId = new Map(SOURCES.map((s) => [s.id, s]))
        const rankedIds = new Set(ranking.map((r) => r.id))
        const latinos = ranking.filter((r) => r.ok && byId.get(r.id)?.esLat).map((r) => byId.get(r.id))
        const others  = ranking.filter((r) => r.ok && !byId.get(r.id)?.esLat).map((r) => byId.get(r.id))
        const failed  = ranking.filter((r) => !r.ok).map((r) => byId.get(r.id))
        const unmeasured = SOURCES.filter((s) => !rankedIds.has(s.id))
        ordered = [...latinos, ...others, ...unmeasured, ...failed].filter(Boolean)
      }
    }
  } catch {}

  if (remembered) {
    const idx = ordered.findIndex((s) => s.id === remembered)
    if (idx > 0) ordered = [ordered[idx], ...ordered.slice(0, idx), ...ordered.slice(idx + 1)]
  }

  const byId = new Map(ordered.map((s) => [s.id, s]))
  const priority = LATAM_PRIORITY_IDS.map((id) => byId.get(id)).filter(Boolean)
  const prioritySet = new Set(LATAM_PRIORITY_IDS)
  const rest = ordered.filter((s) => !prioritySet.has(s.id))
  return [...priority, ...rest]
}

export const buildUrl = (source, { mediaType, id, season = 1, episode = 1 }) => {
  if (!source || !id) return ''
  return mediaType === 'tv' ? source.tvUrl(id, season, episode) : source.movieUrl(id)
}
