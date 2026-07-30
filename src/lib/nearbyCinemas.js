// ─────────────────────────────────────────────────────────────────────────
// Cines cercanos vía Overpass API de OpenStreetMap.
//   - Gratis, sin API key
//   - Datos comunitarios, cobertura excelente en LATAM
//   - Pedimos amenity=cinema en un radio configurable
// ─────────────────────────────────────────────────────────────────────────

// Varios mirrors de Overpass. Si el primero falla/tarda, probamos el siguiente.
// Todos con CORS '*' verificados. Esto evita el "Failed to fetch" de antes
// (cuando dependíamos de un solo endpoint que estaba saturado).
const OVERPASS_MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
]
const PER_MIRROR_TIMEOUT = 12000

const CACHE_KEY = 'repelis:nearbyCinemas:v1'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000   // 24h

const safeGet = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed.ts || Date.now() - parsed.ts > CACHE_TTL_MS) return null
    return parsed
  } catch { return null }
}

const safeSet = (data) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), ...data })) } catch {}
}

// Fórmula de Haversine — distancia entre dos puntos lat/lng en km
const distanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Pide permiso al usuario y devuelve sus coords.
 * Texto del prompt lo decide el browser. Lo que controlamos: ANTES del
 * navigator.geolocation, mostramos un explainer claro de para qué.
 */
export const getUserCoords = ({ timeout = 8000, highAccuracy = true } = {}) => {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation_not_supported')); return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      (err) => reject(new Error(
        err.code === 1 ? 'permission_denied' :
        err.code === 2 ? 'position_unavailable' :
        err.code === 3 ? 'timeout' : 'unknown'
      )),
      { timeout, enableHighAccuracy: highAccuracy, maximumAge: 60_000 },
    )
  })
}

/**
 * Consulta Overpass con timeout y devuelve cines en radio.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm  default 30 km
 */
export const fetchNearbyCinemas = async (lat, lng, radiusKm = 30) => {
  const cached = safeGet()
  if (cached && cached.lat === lat && cached.lng === lng && cached.radiusKm === radiusKm) {
    return cached.cinemas
  }

  const radiusMeters = Math.round(radiusKm * 1000)
  const query = `
    [out:json][timeout:25];
    (
      node["amenity"="cinema"](around:${radiusMeters},${lat},${lng});
      way["amenity"="cinema"](around:${radiusMeters},${lat},${lng});
    );
    out center tags;
  `.trim()

  // Probamos cada mirror en orden hasta que uno responda JSON válido.
  const tryMirror = async (url) => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), PER_MIRROR_TIMEOUT)
    try {
      const res = await fetch(url, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`overpass_${res.status}`)
      return await res.json()
    } finally {
      clearTimeout(timer)
    }
  }

  let data = null
  let lastErr = null
  for (const url of OVERPASS_MIRRORS) {
    try {
      data = await tryMirror(url)
      if (data && Array.isArray(data.elements)) break
    } catch (e) {
      lastErr = e
      data = null
    }
  }
  if (!data) throw lastErr || new Error('overpass_all_failed')
  const cinemas = (data.elements || [])
    .map((el) => {
      const cLat = el.lat ?? el.center?.lat
      const cLng = el.lon ?? el.center?.lon
      if (cLat == null || cLng == null) return null
      const tags = el.tags || {}
      return {
        id: `${el.type}-${el.id}`,
        name: tags.name || tags['name:es'] || 'Cine sin nombre',
        brand: tags.brand || tags.operator || null,
        address: [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
          .filter(Boolean).join(' '),
        website: tags.website || tags['contact:website'] || null,
        phone: tags.phone || tags['contact:phone'] || null,
        lat: cLat,
        lng: cLng,
        distanceKm: distanceKm(lat, lng, cLat, cLng),
        openingHours: tags.opening_hours || null,
        wheelchair: tags.wheelchair || null,
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.distanceKm - b.distanceKm)

  safeSet({ lat, lng, radiusKm, cinemas })
  return cinemas
}

export const clearCinemasCache = () => {
  try { localStorage.removeItem(CACHE_KEY) } catch {}
}

// Helper: link a Google Maps para llegar al cine
export const mapsDirectionsUrl = (lat, lng, name = '') =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}`
