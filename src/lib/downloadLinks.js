// ─────────────────────────────────────────────────────────────────────────
// Generadores de URL hacia servicios externos de descarga.
//
// IMPORTANTE: ninguno de estos los controlamos. Son redirects a third-parties
// que pueden cambiar, caer o servir publicidad agresiva. Por eso:
//   - Abrimos en window nueva con noopener noreferrer.
//   - Mostramos disclaimer al usuario antes del primer clic.
//   - Tenemos 2 fallbacks por si el primero está caído.
// ─────────────────────────────────────────────────────────────────────────

export const DOWNLOAD_SOURCES = [
  {
    id: 'vidsrc-dl',
    label: 'VidSrc DL',
    movieUrl: (id) => `https://dl.vidsrc.vip/movie/${id}`,
    tvUrl:    (id, s, e) => `https://dl.vidsrc.vip/tv/${id}/${s}/${e}`,
  },
  {
    id: 'autoembed-dl',
    label: 'AutoEmbed DL',
    movieUrl: (id) => `https://autoembed.cc/movie/tmdb/${id}`,
    tvUrl:    (id, s, e) => `https://autoembed.cc/tv/tmdb/${id}-${s}-${e}`,
  },
]

export const buildDownloadUrl = ({ mediaType, id, season = 1, episode = 1 }, providerIdx = 0) => {
  const p = DOWNLOAD_SOURCES[providerIdx] || DOWNLOAD_SOURCES[0]
  return mediaType === 'tv' ? p.tvUrl(id, season, episode) : p.movieUrl(id)
}

// Tracking simple del disclaimer (lo mostramos una sola vez por usuario)
const DISCLAIMER_KEY = 'repelis:dlDisclaimer:v1'
export const wasDisclaimerShown = () => {
  try { return localStorage.getItem(DISCLAIMER_KEY) === '1' } catch { return false }
}
export const markDisclaimerShown = () => {
  try { localStorage.setItem(DISCLAIMER_KEY, '1') } catch {}
}
