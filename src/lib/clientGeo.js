// ─────────────────────────────────────────────────────────────────────────
// Geolocalización de IP del cliente vía ipapi.co (servicio público, gratis,
// sin auth). No requiere permiso del usuario (la IP viaja con la request).
//
// Limitación: solo tenemos LA UBICACIÓN DEL CLIENTE QUE LLAMÓ. No agregamos
// visitas de otros usuarios sin un endpoint central (serverless edge function).
// ─────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'repelis:clientGeo:v1'
const TTL_MS = 24 * 60 * 60 * 1000   // 24h cache, evita rate-limit

const safeGet = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed.ts || Date.now() - parsed.ts > TTL_MS) return null
    return parsed
  } catch { return null }
}

const safeSet = (data) => {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ts: Date.now(), ...data })) } catch {}
}

/**
 * Devuelve { country, city, region, lat, lng } o null si falla.
 * Cacheado 24h para no quemar el rate-limit de ipapi.co.
 */
export const getClientGeo = async () => {
  const cached = safeGet()
  if (cached) return cached

  try {
    const res = await fetch('https://ipapi.co/json/', { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (data.error) return null

    const geo = {
      country: data.country_name || data.country || null,
      countryCode: data.country_code || null,
      city: data.city || null,
      region: data.region || null,
      lat: data.latitude || null,
      lng: data.longitude || null,
      ip: data.ip || null,
      timezone: data.timezone || null,
      org: data.org || null,
    }
    safeSet(geo)
    return geo
  } catch {
    return null
  }
}

export const getCachedGeo = () => safeGet()

export const clearGeoCache = () => {
  try { localStorage.removeItem(STORAGE_KEY) } catch {}
}
