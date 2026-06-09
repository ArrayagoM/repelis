// ─────────────────────────────────────────────────────────────────────────
// Service Worker de Repelis
// Estrategias:
//   - App shell (HTML, JS, CSS, SVG): cache-first con revalidación silenciosa.
//   - Imágenes TMDB (image.tmdb.org): stale-while-revalidate.
//   - API TMDB (api.themoviedb.org): network-first con fallback cache (10 min).
//   - Iframes de streaming: NO se cachean (NEVER) — siempre fresh.
// ─────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 'v2'
const SHELL_CACHE  = `repelis-shell-${CACHE_VERSION}`
const IMG_CACHE    = `repelis-img-${CACHE_VERSION}`
const API_CACHE    = `repelis-api-${CACHE_VERSION}`

const API_CACHE_TTL_MS = 10 * 60 * 1000   // 10 min

self.addEventListener('install', (event) => {
  // No precachemos nada en install: el shell se cachea cuando llegue la primera request.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(
      names
        .filter((n) => ![SHELL_CACHE, IMG_CACHE, API_CACHE].includes(n))
        .map((n) => caches.delete(n)),
    )
    await self.clients.claim()
  })())
})

const isImageTMDB = (url) => url.hostname === 'image.tmdb.org'
const isAPITMDB   = (url) => url.hostname === 'api.themoviedb.org'
const isShell     = (url) => url.origin === self.location.origin &&
  /\.(?:html|js|css|svg|woff2?)$/i.test(url.pathname) || url.pathname === '/'

// Stale-while-revalidate
const swr = async (request, cacheName) => {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request).then((res) => {
    if (res && res.ok) cache.put(request, res.clone()).catch(() => {})
    return res
  }).catch(() => cached)
  return cached || network
}

// Network-first con TTL en cache (para API)
const networkFirstTTL = async (request, cacheName, ttlMs) => {
  const cache = await caches.open(cacheName)
  try {
    const fresh = await fetch(request)
    if (fresh && fresh.ok) {
      const cloned = fresh.clone()
      // Guardamos con timestamp en header sintético
      const body = await cloned.blob()
      const headers = new Headers(fresh.headers)
      headers.set('x-cached-at', String(Date.now()))
      cache.put(request, new Response(body, { status: fresh.status, statusText: fresh.statusText, headers })).catch(() => {})
    }
    return fresh
  } catch {
    const cached = await cache.match(request)
    if (cached) {
      const ts = Number(cached.headers.get('x-cached-at')) || 0
      if (Date.now() - ts < ttlMs) return cached
    }
    return cached || Response.error()
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // No tocamos los iframes de streaming
  if (req.destination === 'iframe') return

  if (isImageTMDB(url)) {
    event.respondWith(swr(req, IMG_CACHE))
    return
  }
  if (isAPITMDB(url)) {
    event.respondWith(networkFirstTTL(req, API_CACHE, API_CACHE_TTL_MS))
    return
  }
  if (isShell(url)) {
    event.respondWith(swr(req, SHELL_CACHE))
    return
  }
})
