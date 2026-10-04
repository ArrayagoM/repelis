# Life High — apps nativas

| Plataforma | Tecnología | Carpeta | Archivo que se publica |
|---|---|---|---|
| Android celular/tablet (7.0+) | React Native (Expo SDK 57) | `mobile/` | `lifehigh-android.apk` |
| Android TV / Fire TV / proyector (7.0+) | React Native TV (`react-native-tvos`) | `mobile/` (`EXPO_TV=1`) | `lifehigh-android-tv.apk` |
| Android 5.0 y 6.0 | Capacitor (WebView, versión liviana) | `android/` | `lifehigh.apk` (release `apk-latest`) |
| iPhone / iPad (15.1+) | React Native (Expo) | `mobile/` | `lifehigh-ios.ipa` (sin firmar) |
| Windows 10/11 x64 | Electron | `desktop/` | `LifeHigh-Setup-windows-x64.exe` |
| macOS Apple Silicon / Intel | Electron | `desktop/` | `LifeHigh-mac-arm64.dmg`, `LifeHigh-mac-x64.dmg` |
| Linux x64 | Electron | `desktop/` | `LifeHigh-linux-x86_64.AppImage` |
| Samsung / LG Smart TV | la web (`repelis.vercel.app`) | — | — |

Todos los archivos (menos el APK liviano) se publican en la release fija **`app-latest`**:
`https://github.com/ArrayagoM/repelis/releases/download/app-latest/<archivo>`.
La página `/descargar` del sitio detecta el dispositivo y muestra la descarga correcta + guías de instalación.

## Cómo se compila (todo en GitHub Actions)

`.github/workflows/build-apps.yml` corre en cada push a `main` que toque `mobile/**` o `desktop/**`, o a mano desde
*Actions → Build Apps → Run workflow*. Jobs: `android` (celular y TV), `ios` (runner macOS), `desktop` (Windows, macOS, Linux).

No hace falta Android Studio, Xcode ni una Mac propia.

Secret opcional: `VITE_TMDB_TOKEN` (token de lectura de TMDB). Sin él se usa el mismo token público que ya usa la web.

## Desarrollo local

```bash
# App móvil (vista web con react-native-web, sirve para iterar UI y layouts)
cd mobile && npm install && npm run web        # http://localhost:8081
npm run typecheck && npm test                  # tsc + jest
npx expo-doctor                                # diagnóstico de dependencias

# Probar en un dispositivo/emulador Android (requiere Android SDK + JDK 17)
npm run android
EXPO_TV=1 npx expo prebuild --platform android --clean && npm run android   # modo TV

# Escritorio
cd desktop && npm install
npm start                                      # abre la app cargando el sitio
npx electron .                                 # con LIFEHIGH_URL=http://localhost:5173 apunta a tu dev server
npm run dist:win                               # genera desktop/dist/LifeHigh-Setup-windows-x64.exe
```

Las carpetas `mobile/android` y `mobile/ios` son **generadas** (`expo prebuild`) y están en `.gitignore`: la configuración
nativa vive en `mobile/app.json`, `mobile/app.config.js` y los config plugins.

## Cómo está armada la app móvil

- **Rutas** (`mobile/src/app`): tabs Inicio / Buscar / Películas / Series / Más, detalle `title/[type]/[id]` y reproductor `player/[type]/[id]`.
- **Adaptable** (`src/lib/layout.ts`): celular (3 columnas) → tablet/iPad (5-6) → TV (8, póster grande, foco visible con D-pad). Los componentes interactivos usan `FocusPressable`.
- **Reproductor**: un `WebView` con el mismo iframe y los mismos servidores que la web (`src/lib/playerSources.ts`). VidLink → EmbedMaster → 111Movies siempre primero; salto automático si un servidor no carga en 12 s. Los popups de anuncios se bloquean.
- **Audio en español**: igual que en la web, depende del servidor de cada título. La app avisa cómo cambiar de pista (Audio/CC) o de servidor.
- **Celular**: el reproductor bloquea horizontal; tablets y TV respetan la orientación del dispositivo.

## Limitaciones conocidas

- **React Native exige Android 7.0+.** Para Android 5/6 se mantiene la app Capacitor liviana (`lifehigh.apk`).
- **iOS**: Apple no admite esta app en la App Store, así que el IPA va sin firmar y se instala con AltStore/Sideloadly (con cuenta gratuita hay que renovarlo cada 7 días). Alternativa sin herramientas: Safari → Compartir → *Agregar a pantalla de inicio* (la web es una PWA). Para firmar con cuenta de pago hay que agregar certificado y perfil al workflow.
- **Apple TV (tvOS)** no está incluido: `expo-router` no es compatible con tvOS. Android TV y Fire TV sí.
- **Samsung (Tizen) y LG (webOS)** no admiten apps externas de forma simple: se usa la web, o un Fire TV Stick / TV box Android.
- **Windows/macOS** cargan el sitio en vivo (necesitan internet); `.exe` y `.dmg` no están firmados digitalmente, por eso Windows muestra SmartScreen y macOS pide *click derecho → Abrir* (ver guías en `/descargar`).
- **Descargas offline de películas**: no son posibles. Los videos los sirven iframes de terceros; la app no tiene acceso al archivo de video.
- Firma de Android: los APK se firman con la clave debug estándar de React Native, así cada versión nueva se instala como actualización. Para una clave propia, generá un keystore y configuralo en `mobile/android/app/build.gradle` vía un config plugin.
