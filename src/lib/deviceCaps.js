/**
 * Detección de capacidades del dispositivo. Resultado estable durante la sesión.
 *
 * Criterios para "low-end" (cualquiera dispara):
 *   - navigator.deviceMemory <= 2 GB
 *   - navigator.hardwareConcurrency <= 2 cores
 *   - red lenta (effectiveType <= 3g o downlink < 2)
 *   - saveData activo
 *   - User-Agent de Android TV / SmartTV (proyectores y TVs caen acá)
 */

let _cached = null

export function getDeviceCaps() {
  if (_cached) return _cached
  if (typeof navigator === 'undefined') {
    return { lowEnd: false, isTV: false, memory: null, cores: null, network: 'unknown', saveData: false }
  }

  const memory = navigator.deviceMemory || null               // Chrome only
  const cores  = navigator.hardwareConcurrency || null
  const conn   = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  const eff    = conn?.effectiveType || null
  const down   = conn?.downlink ?? null
  const saveData = !!conn?.saveData
  const ua = (navigator.userAgent || '').toLowerCase()

  const isTV = /\b(smart-tv|smarttv|googletv|appletv|hbbtv|tv\b|crkey|aftt|aftb|aftn|nettv|smart_tv)\b/i.test(ua)

  const memoryLow  = memory !== null && memory <= 2
  const coresLow   = cores !== null && cores <= 2
  const networkLow = eff === 'slow-2g' || eff === '2g' || eff === '3g' || (down !== null && down < 2)

  const lowEnd = memoryLow || coresLow || networkLow || saveData || isTV

  _cached = {
    lowEnd,
    isTV,
    memory,
    cores,
    network: eff || 'unknown',
    downlink: down,
    saveData,
  }

  if (typeof console !== 'undefined' && lowEnd) {
    console.info('[Repelis] Modo low-end activado:', _cached)
  }

  return _cached
}

export const isLowEnd = () => getDeviceCaps().lowEnd
export const isTV     = () => getDeviceCaps().isTV
