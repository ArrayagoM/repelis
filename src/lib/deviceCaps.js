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

  // TVs, set-top boxes, proyectores Android, palos HDMI, dongles
  const isTV = /\b(smart-?tv|googletv|google_tv|appletv|hbbtv|tv\b|crkey|chromecast|aftt|aftb|aftn|aftm|aftr|aftka|nettv|smart_tv|web0s|webos|tizen|netcast|viera|bravia|philips-tv|sony-tv|lg-tv|samsung-tv|sharp-tv|panasonic-tv|tv ?box|stb\b|amlogic|rockchip|allwinner|projector|miracast|displaylink|firetv|fire tv|aft|miflip|mi tv|xiaomi-tv|hisense-tv|vidaa|tcl-tv|toshiba-tv|orange-tv|movistar-tv)\b/i.test(ua)

  // Heurística TV/proyector "incógnito": pantalla >= 1280, DPR=1, sin touch.
  // Una PC normal típicamente tiene DPR >= 1.25 (Windows scaling) o pantalla < 1280.
  let isProbablyTV = false
  try {
    const sw = window.screen?.width || 0
    const dpr = window.devicePixelRatio || 1
    const noTouch = !('ontouchstart' in window) && (navigator.maxTouchPoints || 0) === 0
    const coarse = window.matchMedia?.('(pointer: coarse)').matches
    const noHover = window.matchMedia?.('(hover: none)').matches
    // TV/proyector: sin touch + sin hover real + pantalla grande + DPR exacto 1
    if (sw >= 1280 && dpr === 1 && noTouch && (coarse || noHover)) {
      isProbablyTV = true
    }
  } catch {}

  // Sólo se activa low-end cuando hay UNA señal explícita y dura.
  // Cero detección "por las dudas" que pueda penalizar PCs/móviles normales.
  const memoryLow  = memory !== null && memory <= 2
  const coresLow   = cores !== null && cores <= 2
  const networkLow = eff === 'slow-2g' || eff === '2g'

  // El proyector cae acá: UA de TV/STB, o la heurística viewport "sin touch
  // + DPR=1 + pantalla >=1280" que es típica de salidas HDMI a TV/proyector.
  const lowEnd = isTV || isProbablyTV || memoryLow || coresLow || networkLow || saveData

  _cached = {
    lowEnd,
    isTV: isTV || isProbablyTV,
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
