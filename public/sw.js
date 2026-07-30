// ─────────────────────────────────────────────────────────────────────────
// Service Worker de Repelis
// Estrategias:
//   - App shell (HTML, JS, CSS, SVG): cache-first con revalidación silenciosa.
//   - Imágenes TMDB (image.tmdb.org): stale-while-revalidate.
//   - API TMDB (api.themoviedb.org): network-first con fallback cache (10 min).
//   - Iframes de streaming: NO se cachean (NEVER) — siempre fresh.
// ─────────────────────────────────────────────────────────────────────────

// IMPORTANTE: bumpear esta versión en cada deploy de rebrand/cambio de UI
// para forzar la purga del cache viejo y traer el nuevo bundle.
const CACHE_VERSION = 'v6-langs-servers'
const SHELL_CACHE  = `repelis-shell-${CACHE_VERSION}`
const IMG_CACHE    = `repelis-img-${CACHE_VERSION}`
const API_CACHE    = `repelis-api-${CACHE_VERSION}`

const API_CACHE_TTL_MS = 10 * 60 * 1000   // 10 min
const IMG_CACHE_MAX = 80                  // tope de pósters cacheados (RAM low-end)
const SHELL_CACHE_MAX = 40                // tope archivos shell

const trimCache = async (cacheName, max) => {
  try {
    const cache = await caches.open(cacheName)
    const keys = await cache.keys()
    if (keys.length <= max) return
    // FIFO: borrar las más viejas (primeras en keys())
    const toDelete = keys.length - max
    for (let i = 0; i < toDelete; i++) await cache.delete(keys[i])
  } catch {}
}

self.addEventListener('install', (event) => {
  // No precachemos nada en install: el shell se cachea cuando llegue la primera request.
  self.skipWaiting()
})

// El cliente puede mandar SKIP_WAITING desde UpdateAvailable para forzar
// la activación inmediata del SW nuevo sin esperar a cerrar todas las pestañas.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
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
const isShell     = (url) => url.origin === self.location.origin && (
  /\.(?:html|js|css|svg|woff2?|webmanifest|ico|png|jpg)$/i.test(url.pathname) ||
  url.pathname === '/'
)

// Stale-while-revalidate con cap de entradas (FIFO)
const swr = async (request, cacheName, maxEntries = null) => {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  const network = fetch(request).then((res) => {
    if (res && res.ok) {
      cache.put(request, res.clone())
        .then(() => maxEntries && trimCache(cacheName, maxEntries))
        .catch(() => {})
    }
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

  // Navegación SPA: network-first STRICTO.
  // El HTML siempre se trae fresh — sin esto, el cache podía servir un
  // index.html viejo que referenciaba bundles JS que ya no existen en
  // Vercel después de un deploy (el usuario ve la versión vieja).
  // Solo caemos al cache si la red FALLA por completo (offline).
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        // Force no-cache para asegurar HTML fresco siempre
        const fresh = await fetch(req, { cache: 'no-store' })
        if (fresh && fresh.ok) {
          const cache = await caches.open(SHELL_CACHE)
          cache.put('/', fresh.clone()).catch(() => {})
        }
        return fresh
      } catch {
        // Solo aquí caemos al cache: cuando NO hay red en absoluto.
        const cache = await caches.open(SHELL_CACHE)
        const cached = await cache.match('/') || await cache.match('/index.html')
        if (cached) return cached
        return new Response(
          '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sin conexión</title><style>body{background:#08080E;color:#F0EDE8;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}</style></head><body><div><h1 style="color:#E8A020">Sin conexión</h1><p>Volvé a intentar cuando tengas internet.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
        )
      }
    })())
    return
  }

  if (isImageTMDB(url)) {
    event.respondWith(swr(req, IMG_CACHE, IMG_CACHE_MAX))
    return
  }
  if (isAPITMDB(url)) {
    event.respondWith(networkFirstTTL(req, API_CACHE, API_CACHE_TTL_MS))
    return
  }
  if (isShell(url)) {
    event.respondWith(swr(req, SHELL_CACHE, SHELL_CACHE_MAX))
    return
  }
})
