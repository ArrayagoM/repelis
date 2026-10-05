// Catálogo de descargas de Life High. Los archivos los publica .github/workflows/build-apps.yml
// en la release fija "app-latest" (y el APK liviano histórico en "apk-latest").
// Mantener en sync con mobile/src/lib/downloads.ts.
const REPO = 'https://github.com/ArrayagoM/repelis'
export const RELEASE_BASE = `${REPO}/releases/download/app-latest`
export const LEGACY_RELEASE_BASE = `${REPO}/releases/download/apk-latest`
export const RELEASES_PAGE = `${REPO}/releases`
export const WEB_URL = 'https://repelis.vercel.app'
// Links cortos (redirigen a GitHub, ver vercel.json): se pueden tipear con el control remoto en la app Downloader.
export const TV_SHORT_LINK = 'repelis.vercel.app/tv.apk'

// platform = grupo para detectar el dispositivo del visitante.
export const DOWNLOADS = [
  {
    id: 'android', platform: 'android', icon: 'android', primary: true,
    label: 'Android — celular y tablet',
    detail: 'Android 7.0 o superior · APK universal (ARM 32/64 bits, x86_64)',
    file: 'lifehigh-android.apk', url: `${RELEASE_BASE}/lifehigh-android.apk`,
  },
  {
    id: 'android-tv', platform: 'tv', icon: 'tv', primary: true,
    label: 'Android TV · Fire TV · proyector · TV box',
    detail: 'Se maneja con el control remoto · Android TV / Google TV / Fire OS 7+',
    file: 'lifehigh-android-tv.apk', url: `${RELEASE_BASE}/lifehigh-android-tv.apk`,
  },
  {
    id: 'android-legacy', platform: 'android', icon: 'android', primary: false,
    label: 'Android — versión liviana',
    detail: 'Android 7.0+ · ~6 MB · para equipos con poca memoria o proyectores justos',
    file: 'lifehigh.apk', url: `${LEGACY_RELEASE_BASE}/lifehigh.apk`,
  },
  {
    id: 'ios', platform: 'ios', icon: 'apple', primary: false,
    label: 'iPhone y iPad — archivo IPA (avanzado)',
    detail: 'Solo si sabés usar AltStore o Sideloadly. Para la mayoría es mucho más fácil instalarla desde Safari (pasos arriba).',
    file: 'lifehigh-ios.ipa', url: `${RELEASE_BASE}/lifehigh-ios.ipa`,
  },
  {
    id: 'windows', platform: 'windows', icon: 'windows', primary: true,
    label: 'Windows 10 / 11',
    detail: 'Instalador .exe de 64 bits',
    file: 'LifeHigh-Setup-windows-x64.exe', url: `${RELEASE_BASE}/LifeHigh-Setup-windows-x64.exe`,
  },
  {
    id: 'mac-arm', platform: 'mac', icon: 'mac', primary: true,
    label: 'Mac — Apple Silicon (M1, M2, M3, M4)',
    detail: 'Imagen .dmg · macOS 11+',
    file: 'LifeHigh-mac-arm64.dmg', url: `${RELEASE_BASE}/LifeHigh-mac-arm64.dmg`,
  },
  {
    id: 'mac-intel', platform: 'mac', icon: 'mac', primary: false,
    label: 'Mac — Intel',
    detail: 'Imagen .dmg · macOS 11+',
    file: 'LifeHigh-mac-x64.dmg', url: `${RELEASE_BASE}/LifeHigh-mac-x64.dmg`,
  },
  {
    id: 'linux', platform: 'linux', icon: 'linux', primary: true,
    label: 'Linux',
    detail: 'AppImage de 64 bits (marcá el archivo como ejecutable y abrilo)',
    file: 'LifeHigh-linux-x86_64.AppImage', url: `${RELEASE_BASE}/LifeHigh-linux-x86_64.AppImage`,
  },
]

// maxTouchPoints: null = desconocido. Los proyectores y TV box Android reportan 0 (sin pantalla táctil).
export const detectPlatform = (ua = '', maxTouchPoints = null) => {
  const s = String(ua)
  if (/android/i.test(s) && /(tv|aft[a-z]*|bravia|mibox|shield|crkey|philips|hisense|vizio)/i.test(s) && !/mobile/i.test(s)) return 'tv'
  if (/android/i.test(s)) return maxTouchPoints === 0 ? 'tv' : 'android'
  if (/(iphone|ipad|ipod)/i.test(s)) return 'ios'
  // iPadOS 13+ se presenta como Mac con pantalla táctil
  if (/macintosh|mac os x/i.test(s) && maxTouchPoints > 1) return 'ios'
  if (/windows/i.test(s)) return 'windows'
  if (/macintosh|mac os x/i.test(s)) return 'mac'
  if (/(smart-?tv|tizen|web0s|webos|netcast|hbbtv)/i.test(s)) return 'smarttv'
  if (/linux|x11|cros/i.test(s)) return 'linux'
  return 'other'
}

/** Descarga principal recomendada para la plataforma detectada (null si no hay instalador). */
export const recommendedFor = (platform) => {
  if (platform === 'smarttv' || platform === 'other') return null
  const options = DOWNLOADS.filter((d) => d.platform === platform && d.primary)
  return options[0] || null
}

export const downloadsFor = (platform) => DOWNLOADS.filter((d) => d.platform === platform)
