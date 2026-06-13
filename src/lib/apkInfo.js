// URL estable del APK más reciente (el workflow lo mantiene actualizado)
export const APK_URL = 'https://github.com/ArrayagoM/repelis/releases/download/apk-latest/lifehigh.apk'

// Página de releases por si quieren ver historial / versiones anteriores
export const APK_RELEASES_PAGE = 'https://github.com/ArrayagoM/repelis/releases'

// Detección de plataforma para mostrar el botón solo donde tiene sentido
export const isAndroid = () => {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

export const isDesktop = () => {
  if (typeof navigator === 'undefined') return true
  const ua = navigator.userAgent
  return !/(android|iphone|ipad|ipod)/i.test(ua)
}

export const APK_INFO = {
  minAndroid: '5.0',          // Lollipop
  minApi: 21,
  targetAndroid: '14',
  size: '~6 MB',
  arch: 'Universal (ARM, ARM64, x86)',
}
