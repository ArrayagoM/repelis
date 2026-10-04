// URLs estables de descarga (las mantiene .github/workflows/build-apps.yml). Mantener en sync con src/lib/downloads.js de la web.
const RELEASE = 'https://github.com/ArrayagoM/repelis/releases/download/app-latest'
const LEGACY_RELEASE = 'https://github.com/ArrayagoM/repelis/releases/download/apk-latest'

export interface DownloadOption {
  id: string
  label: string
  detail: string
  url: string
  icon: 'logo-android' | 'tv-outline' | 'logo-apple' | 'logo-windows' | 'desktop-outline' | 'globe-outline'
}

export const DOWNLOADS_PAGE = 'https://repelis.vercel.app/descargar'

export const DOWNLOAD_OPTIONS: DownloadOption[] = [
  { id: 'android', label: 'Android (celular y tablet)', detail: 'Android 7.0+ · APK universal', url: `${RELEASE}/lifehigh-android.apk`, icon: 'logo-android' },
  { id: 'android-tv', label: 'Android TV / Fire TV / proyector', detail: 'Control remoto · Android TV 7.0+', url: `${RELEASE}/lifehigh-android-tv.apk`, icon: 'tv-outline' },
  { id: 'android-legacy', label: 'Android antiguo (5.0 y 6.0)', detail: 'Versión liviana compatible con Android 5.0+', url: `${LEGACY_RELEASE}/lifehigh.apk`, icon: 'logo-android' },
  { id: 'ios', label: 'iPhone y iPad', detail: 'IPA para instalar con AltStore / Sideloadly', url: `${RELEASE}/lifehigh-ios.ipa`, icon: 'logo-apple' },
  { id: 'windows', label: 'Windows 10 / 11', detail: 'Instalador .exe (64 bits)', url: `${RELEASE}/LifeHigh-Setup-windows-x64.exe`, icon: 'logo-windows' },
  { id: 'mac-arm', label: 'Mac (Apple Silicon M1–M4)', detail: 'Imagen .dmg', url: `${RELEASE}/LifeHigh-mac-arm64.dmg`, icon: 'desktop-outline' },
  { id: 'mac-intel', label: 'Mac (Intel)', detail: 'Imagen .dmg', url: `${RELEASE}/LifeHigh-mac-x64.dmg`, icon: 'desktop-outline' },
  { id: 'web', label: 'Smart TV Samsung / LG y navegador', detail: 'Abrí el sitio desde el navegador del TV', url: 'https://repelis.vercel.app', icon: 'globe-outline' },
]
