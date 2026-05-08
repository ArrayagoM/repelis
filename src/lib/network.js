/**
 * Lectura del Network Information API (cuando existe).
 *  - quality: 'slow' | 'moderate' | 'good' | 'unknown'
 *  - saveData: respeta el toggle del usuario para no quemar datos.
 */
export const getNetworkInfo = () => {
  const conn =
    typeof navigator !== 'undefined' &&
    (navigator.connection || navigator.mozConnection || navigator.webkitConnection)

  if (!conn) return { quality: 'unknown', saveData: false, downlink: null, effectiveType: null }

  const { effectiveType, downlink, saveData } = conn
  let quality = 'unknown'
  if (effectiveType === 'slow-2g' || effectiveType === '2g' || (downlink && downlink < 1.5)) quality = 'slow'
  else if (effectiveType === '3g' || (downlink && downlink < 5)) quality = 'moderate'
  else if (effectiveType) quality = 'good'

  return { quality, saveData: !!saveData, downlink: downlink ?? null, effectiveType: effectiveType ?? null }
}

export const useIsSlow = (info) => info.quality === 'slow' || info.quality === 'moderate'
