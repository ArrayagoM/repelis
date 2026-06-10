# Life High — APK para Android (proyector / TV box)

Tres caminos ordenados de más fácil a más control. Elegí uno.

---

## 🚀 Opción A — PWA Builder (5 minutos, cero código)

1. Andá a **https://www.pwabuilder.com**
2. Pegá: `https://repelis.vercel.app`
3. Click **"Start"** → revisá el score de PWA (Life High ya tiene manifest + SW)
4. Click **"Package for Stores"** → **Android**
5. **"Generate Package"** → descargás un `.zip`
6. Dentro hay un **`app-release-signed.apk`**
7. Pasalo al proyector por USB e instalalo

✅ **Pros:** instantáneo, firmado, listo para Play Store
❌ **Contras:** el WebView interno es el del sistema, sin tuneo

---

## ⚙️ Opción B — Capacitor (30 min, código JS)

Aprovecha que la app ya está hecha en Vite + React. Capacitor la empaqueta en APK.

```bash
cd "C:/Users/jmarr/OneDrive/Desktop/Repelis"
npm install --save-dev @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Life High" "app.lifehigh.android" --web-dir=dist
npm run build
npx cap add android
npx cap copy
npx cap open android       # abre Android Studio
```

Después en Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

El APK queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

✅ **Pros:** la app corre offline desde el APK (incluye el `dist/`)
❌ **Contras:** APK pesado (~15 MB), necesitás Android Studio igual al final

---

## 🛠️ Opción C — Android Studio WebView nativo (mi recomendación para tu proyector)

Esta es la opción con más control. El WebView se configura explícitamente para
hardware acceleration, cache grande, fullscreen sin barras, sin Chrome warnings.

### Setup (una sola vez)

1. Bajá **Android Studio**: https://developer.android.com/studio
2. Instalalo
3. Abrí Android Studio → **New Project** → **Empty Views Activity** → **Kotlin**
4. Nombre: `Life High`
5. Package: `app.lifehigh.tv`
6. Minimum SDK: **API 21 (Android 5.0)** — cubre 99% de proyectores
7. Esperá a que termine el Gradle sync

### Reemplazá los archivos por los que están en esta carpeta

Copiá **el contenido** de cada archivo de `android-apk/` al archivo equivalente
de tu proyecto recién creado en Android Studio:

| De este repo (`android-apk/`) | Reemplaza en Android Studio |
|---|---|
| `MainActivity.kt` | `app/src/main/java/app/lifehigh/tv/MainActivity.kt` |
| `AndroidManifest.xml` | `app/src/main/AndroidManifest.xml` |
| `activity_main.xml` | `app/src/main/res/layout/activity_main.xml` |
| `strings.xml` | `app/src/main/res/values/strings.xml` |
| `colors.xml` | `app/src/main/res/values/colors.xml` |
| `themes.xml` | `app/src/main/res/values/themes.xml` |
| `network_security_config.xml` | `app/src/main/res/xml/network_security_config.xml` *(crearlo)* |

### Build del APK

1. En Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Esperá ~1 min
3. Abajo a la derecha aparece notificación: **"locate"** → te lleva al `.apk`
4. APK queda en: `app/build/outputs/apk/debug/app-debug.apk`
5. Tamaño aprox: **3-4 MB** (es solo el wrapper, la app vive online)

### Instalación en el proyector

1. Conectá el proyector por USB a tu PC
2. En el proyector: **Settings → System → Developer Options → USB debugging ON**
3. Si no aparece Developer Options: tap 7 veces en "Build Number" en Settings → About
4. En tu PC, con ADB instalado (viene con Android Studio):

```bash
adb devices                                  # confirmá que aparece el proyector
adb install app-release.apk                  # instala
adb shell am start -n app.lifehigh.tv/.MainActivity   # abre la app
```

### Si no querés ADB

1. Copiá el `.apk` al proyector con un pendrive USB
2. En el proyector, abrí el explorador de archivos
3. Tap en el `.apk` → **Instalar** (puede que pida habilitar "instalar de fuentes desconocidas")
4. Listo

---

## 🎯 Diferencias clave de Opción C vs PWA Builder

| | PWA Builder | Android Studio WebView (Opción C) |
|---|---|---|
| Hardware acceleration | Default del sistema | **Forzado HIGH priority** |
| Cache offline | Solo SW | **+ WebView cache 30 MB** |
| Fullscreen sin barras | No | **Sí (immersive)** |
| Reproducción inline `<video>` | Default | **Forzado true** |
| Mixed content para iframes | Bloqueado | **Permitido** (necesario para los embeds) |
| Tamaño APK | ~8 MB | **~3 MB** |
| Auto-updates de la web | Sí (mismo URL) | **Sí (mismo URL)** |

---

## ¿Cómo se actualiza el APK cuando deployo cambios en la web?

**No necesitás reinstalar.** El APK abre `https://repelis.vercel.app` cada vez.
Cuando vos deployás en Vercel, la próxima vez que abras el APK ya ves los cambios
(el SW notifica con el toast "Nueva versión disponible").

El APK solo hay que recompilar si cambiamos algo del **wrapper Android** mismo
(permisos, settings del WebView, icono).
