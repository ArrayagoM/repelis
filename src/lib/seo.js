// ─────────────────────────────────────────────────────────────────────────
// Helpers para SEO dinámico en SPA.
// Inyecta/actualiza meta tags + Schema.org JSON-LD por página.
// ─────────────────────────────────────────────────────────────────────────

const BRAND = 'Life High'
const TAGLINE = 'Cinema sin límites'
const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://repelis.vercel.app'

const setMetaTag = (selector, attr, value) => {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    const [, key, val] = selector.match(/\[(.+?)="(.+?)"\]/) || []
    if (key && val) el.setAttribute(key, val)
    document.head.appendChild(el)
  }
  el.setAttribute(attr, value)
}

const setLink = (rel, href) => {
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Setea title + description + canonical + OG + Twitter cards.
 * Volverlo a llamar en cada navegación a una nueva página.
 */
export const setPageSEO = ({
  title,
  description,
  image,
  type = 'website',
  url,
  keywords,
  noindex = false,
}) => {
  if (typeof document === 'undefined') return

  const fullTitle = title ? `${title} — ${BRAND}` : `${BRAND} — ${TAGLINE}`
  const desc = description || `${BRAND}: el catálogo más completo de películas, series, anime y K-drama. Encontrá dónde ver cualquier estreno en LATAM.`
  const canonical = url || (typeof window !== 'undefined' ? window.location.href : BASE_URL)

  document.title = fullTitle

  setMetaTag('meta[name="description"]', 'content', desc)
  if (keywords) setMetaTag('meta[name="keywords"]', 'content', keywords)
  if (noindex) setMetaTag('meta[name="robots"]', 'content', 'noindex, follow')
  else         setMetaTag('meta[name="robots"]', 'content', 'index, follow, max-image-preview:large')

  // Open Graph
  setMetaTag('meta[property="og:title"]', 'content', fullTitle)
  setMetaTag('meta[property="og:description"]', 'content', desc)
  setMetaTag('meta[property="og:type"]', 'content', type)
  setMetaTag('meta[property="og:url"]', 'content', canonical)
  setMetaTag('meta[property="og:site_name"]', 'content', BRAND)
  setMetaTag('meta[property="og:locale"]', 'content', 'es_AR')
  if (image) setMetaTag('meta[property="og:image"]', 'content', image)

  // Twitter
  setMetaTag('meta[name="twitter:card"]', 'content', image ? 'summary_large_image' : 'summary')
  setMetaTag('meta[name="twitter:title"]', 'content', fullTitle)
  setMetaTag('meta[name="twitter:description"]', 'content', desc)
  if (image) setMetaTag('meta[name="twitter:image"]', 'content', image)

  setLink('canonical', canonical)
}

// ─── Schema.org JSON-LD ───────────────────────────────────────────────────
const setSchema = (json) => {
  let el = document.head.querySelector('script[type="application/ld+json"][data-seo="page"]')
  if (!el) {
    el = document.createElement('script')
    el.setAttribute('type', 'application/ld+json')
    el.setAttribute('data-seo', 'page')
    document.head.appendChild(el)
  }
  el.textContent = JSON.stringify(json)
}

export const setMovieSchema = (movie) => {
  if (!movie) return
  setSchema({
    '@context': 'https://schema.org',
    '@type': 'Movie',
    name: movie.title,
    alternateName: movie.original_title,
    image: movie.poster_path ? `https://image.tmdb.org/t/p/w780${movie.poster_path}` : undefined,
    description: movie.overview,
    datePublished: movie.release_date,
    duration: movie.runtime ? `PT${movie.runtime}M` : undefined,
    inLanguage: movie.original_language,
    aggregateRating: movie.vote_average ? {
      '@type': 'AggregateRating',
      ratingValue: movie.vote_average,
      bestRating: 10,
      worstRating: 0,
      ratingCount: movie.vote_count,
    } : undefined,
    genre: movie.genres?.map((g) => g.name),
    productionCompany: movie.production_companies?.map((c) => ({
      '@type': 'Organization',
      name: c.name,
    })),
    countryOfOrigin: movie.production_countries?.map((c) => ({
      '@type': 'Country',
      name: c.name,
    })),
  })
}

export const setTVSchema = (show) => {
  if (!show) return
  setSchema({
    '@context': 'https://schema.org',
    '@type': 'TVSeries',
    name: show.name,
    alternateName: show.original_name,
    image: show.poster_path ? `https://image.tmdb.org/t/p/w780${show.poster_path}` : undefined,
    description: show.overview,
    startDate: show.first_air_date,
    endDate: show.last_air_date,
    numberOfSeasons: show.number_of_seasons,
    numberOfEpisodes: show.number_of_episodes,
    inLanguage: show.original_language,
    aggregateRating: show.vote_average ? {
      '@type': 'AggregateRating',
      ratingValue: show.vote_average,
      bestRating: 10,
      worstRating: 0,
      ratingCount: show.vote_count,
    } : undefined,
    genre: show.genres?.map((g) => g.name),
  })
}

export const setOrgSchema = () => {
  // Schema base de la organización (se setea en Home y se mantiene)
  const el = document.createElement('script')
  el.setAttribute('type', 'application/ld+json')
  el.setAttribute('data-seo', 'org')
  el.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: BRAND,
    alternateName: 'LifeHigh',
    url: BASE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${BASE_URL}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
    description: `${BRAND}: el catálogo más completo de películas, series, anime y K-drama. Encontrá dónde ver cualquier estreno en LATAM.`,
    inLanguage: 'es-AR',
  })
  // Si ya existe, no duplicar
  if (!document.head.querySelector('script[data-seo="org"]')) {
    document.head.appendChild(el)
  }
}

export const BRAND_NAME = BRAND
export const BRAND_TAGLINE = TAGLINE
