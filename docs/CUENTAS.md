# Cuentas de usuario (opcionales) y sincronización

Ingreso con **Google** (principal) y con mail y contraseña (alternativa). Sirve para sincronizar **Mi lista, Continuar viendo, avisos, logros y Supporter**
entre dispositivos. Sin cuenta, todo sigue funcionando igual (guardado en el dispositivo).

## Qué se ve libre y qué pide cuenta

**Siempre libre (sin registrarse):** buscar, ver listados y fichas, el Top 10, el calendario, los cines, y **reproducir** cualquier título que no sea de los "más calificados o populares".

**Pide cuenta gratis:**
- **Reproducir** los títulos más calificados o más populares (regla en `src/lib/access.js`, calculada con los datos de TMDB, sin listas armadas a mano):
  - Películas: nota ≥ 7,5 con ≥ 1000 votos, **o** popularidad ≥ 150.
  - Series: nota ≥ 7,5 con ≥ 1000 votos, **o** popularidad ≥ 500 (las series usan otra escala).
- **Mi lista** (el botón +), **Continuar viendo**, recomendadas, capítulos nuevos y logros.

Sin cuenta, esos títulos muestran un candado "Cuenta" en la tarjeta y, al darles play, un aviso con el botón de Google y los accesos a crear cuenta o ingresar (no se carga el video).
Lo que alguien ya tenía guardado en el dispositivo se **suma a su cuenta** al registrarse.

Si el servicio de cuentas no responde (`unavailable`), **nada se bloquea**: todo se ve y las funciones siguen locales.
Los umbrales son números en `ACCESS_RULES`: cambiarlos es editar una línea.

> Es un límite de cortesía del lado del navegador: el video lo sirven reproductores de terceros, así que una persona técnica puede saltearlo.
> Sirve para invitar a registrarse, no como seguridad.

## Panel del fundador (`/panel`)

Solo para cuentas **root**: las que tienen su mail en la variable `ROOT_EMAILS` de Vercel (varios separados por coma) **y verificado**.
Para cualquier otra persona la página y la API responden "404" (ni confirman que existe). El permiso se decide siempre en el servidor.

Muestra, en hora de Argentina y con rango Hoy / 7 / 30 días:
- **En vivo** (se actualiza solo cada 15 s): conectados ahora, cuántos están viendo algo, qué títulos, con cuenta vs sin cuenta, países y plataformas.
- **Resumen**: visitantes, páginas vistas, **horas vistas**, reproducciones, tiempo medio por reproducción, tiempo en el sitio, registros nuevos (con variación contra el período anterior).
- **Lo más visto** por tiempo y por cantidad de reproducciones, horas pico, países, dispositivos, plataformas, páginas, miembros vs invitados.
- **Cuentas**: totales, Google vs mail, verificados, supporters, registros por día y últimos registros (mails enmascarados).
- **Embudo**: cuántos vieron el aviso "creá tu cuenta", cuántos se registraron desde ahí (conversión) y los pedidos de apoyo.

Cómo se mide (todo anónimo): cada pestaña manda un "latido" a `/api/pulse` (cada 60 s mirando y cada 120 s navegando, para cuidar el cupo de 1 M de invocaciones/mes del plan gratuito de Vercel) con un id aleatorio que **cambia cada día**,
la página agrupada, la plataforma, si es miembro (sí/no) y qué título mira. El **tiempo de visualización lo calcula el servidor** como la diferencia
entre latidos consecutivos del mismo título (con tope), no lo que declare el navegador. No se guarda IP ni mail. El tráfico del fundador no se cuenta.
Los datos viven en MongoDB (`presence` se borra sola en 1 h; `stats_daily` un documento por día; `stats_titles` se borra a los 120 días).

**Sin datos inventados:** en producción el panel solo muestra tráfico real (empieza en cero desde que se publicó; no hay historia anterior). Los datos de demostración existen solo en desarrollo local y únicamente con `DEV_SEED=1`; si están activos, el panel muestra un cartel rojo.
**Robots:** los buscadores, vistas previas de links y monitores (por su User-Agent) no se cuentan.

Limitaciones: los números son **indicativos** (cualquiera puede mandar latidos falsos) y "visitantes" se suma día por día (el id rota a diario).
Las apps nativas de React Native todavía no mandan latidos.

También entra al panel técnico `/admin` sin PIN.

## Cómo funciona

- **Backend:** una función de Vercel (`api/auth/[action].js`, Node) + **MongoDB Atlas**.
  Acciones: `register`, `login`, `logout`, `me`, `sync`, `forgot`, `reset`, `verify`, `resend-verification`, `password`, `delete`, `status`.
- **Contraseñas:** hash **scrypt** (módulo `crypto` de Node). Nunca se guardan en claro.
- **Sesión:** token aleatorio en cookie `lh_session` (**HttpOnly, Secure, SameSite=Lax**, 30 días). En la base solo se guarda su hash,
  así que se puede revocar y una filtración de la base no sirve para entrar.
- **Anti-abuso:** límite de intentos por IP y por cuenta (contadores en Mongo con TTL), mismas respuestas para mail inexistente,
  POST solo JSON y del mismo origen (anti-CSRF), tokens de verificación/recuperación de un solo uso (24 h / 1 h).
- **Sincronización:** el navegador sube cambios (con 4 s de respiro y como máximo 1 vez por minuto) y trae lo nuevo al volver a la app.
  Dos copias se **fusionan** (`src/lib/libraryMerge.js`): nunca se pierde nada y lo borrado en un dispositivo no reaparece desde otro
  (tumbas con fecha). Al **cerrar sesión**, la biblioteca se borra de ese dispositivo (sigue en la cuenta).
- **Sin `MONGODB_URI` las cuentas quedan deshabilitadas** y el sitio no muestra botones de cuenta; todo lo demás funciona.

## Variables de entorno (Vercel → Settings → Environment Variables)

| Variable | Obligatoria | Qué es |
|---|---|---|
| `MONGODB_URI` | **Sí** | Cadena de conexión de Atlas (`mongodb+srv://usuario:CLAVE@cluster/...`). |
| `MONGODB_DB` | No | Nombre de la base (por defecto `lifehigh`). |
| `GOOGLE_CLIENT_ID` | Recomendada | Client ID de Google (termina en `.apps.googleusercontent.com`). Es **público**; no hay "client secret" en este flujo. Sin ella no aparece el botón de Google. |
| `RESEND_API_KEY` | No* | Clave de [Resend](https://resend.com) (gratis). *Sin ella no hay mails: no se puede confirmar el mail ni recuperar la contraseña. |
| `MAIL_FROM` | No | Remitente, ej. `Life High <avisos@tudominio.com>`. Sin dominio verificado en Resend solo se puede mandar a tu propio mail (`onboarding@resend.dev`). |
| `ROOT_EMAILS` | Para el panel | Mails de los fundadores/administradores, separados por coma (ej. `tu@gmail.com`). Solo funcionan si el mail está verificado (con Google siempre lo está). |
| `SITE_URL` | No | URL pública para los enlaces de los mails (por defecto `https://repelis.vercel.app`). Poné `https://lifehigh.site` cuando el dominio funcione. |

Cargalas en **Production, Preview y Development** y hacé **Redeploy**.

### Contraseña con caracteres especiales

Si la clave de la base tiene símbolos (`# @ / : ? %`), en la URL hay que escribirlos codificados (`#` → `%23`, `@` → `%40`, `/` → `%2F`, `:` → `%3A`).
Lo más simple: usar la contraseña **autogenerada** de Atlas (solo letras y números).

## Ingreso con Google

El botón oficial de Google entrega un token firmado; el servidor lo verifica (firma con las claves públicas de Google,
emisor, audiencia = nuestro Client ID, vencimiento y mail verificado). No se guardan contraseñas de Google.

- **Primera vez:** crea la cuenta (mail verificado, sin contraseña). **Si el mail ya tenía cuenta**, se vincula.
- **Protección contra pre-secuestro:** si esa cuenta existente nunca había verificado su mail, al vincular Google se **borran su
  contraseña y sus sesiones** (quien la creó pudo no ser el dueño del mail).
- Las cuentas de Google no tienen contraseña (pueden crear una con "Olvidé mi contraseña" si hay mails). Para borrar la cuenta
  se confirma con Google.
- **Apps embebidas:** Google bloquea el ingreso dentro de WebViews (el APK liviano de Capacitor y las apps de escritorio).
  Ahí funciona el ingreso con mail y contraseña; en el navegador y en la PWA instalada funciona Google.

### Alta en Google Cloud (una vez)

1. Cuenta de Google del proyecto → https://console.cloud.google.com → **Crear proyecto** "Life High".
2. **Google Auth Platform → Primeros pasos:** nombre de la app `Life High`, mail de asistencia, público **Externo**, mail de contacto.
3. **Clientes → Crear cliente → Aplicación web.** En **Orígenes de JavaScript autorizados** agregá:
   `https://repelis.vercel.app`, `https://lifehigh.site`, `https://www.lifehigh.site` y `http://localhost:5173`.
   (No hace falta ningún "URI de redireccionamiento".) Copiá el **ID de cliente**.
4. **Público → Publicar la app** (pasar a "En producción"). Sin esto solo pueden entrar los "usuarios de prueba" que cargues.
   Con los permisos básicos (email, perfil) no se necesita verificación de Google.
5. En Vercel cargá `GOOGLE_CLIENT_ID` con ese ID (Production, Preview, Development) y hacé **Redeploy**.

## MongoDB Atlas (checklist)

1. Cluster gratis (M0). Región cercana (São Paulo para Argentina).
2. **Database Access:** un usuario con permiso **solo de lectura y escritura sobre la base `lifehigh`** (no `atlasAdmin`).
3. **Network Access:** `0.0.0.0/0` (Vercel usa IPs que cambian).
4. Las colecciones e índices (`users`, `sessions`, `rate_limits`) se crean solos en el primer pedido.

## Probar

- **Local:** `npm run dev` incluye una API de cuentas **en memoria** (`scripts/dev-api.js`); los mails se imprimen en la terminal.
- **Producción:** `GET /api/auth/status` → `{"enabled":true,"mail":false|true}`.
- **Tests:** `npx vitest run` (la lógica de cuentas, la fusión y el cliente están cubiertos).

## Pendiente / ideas

- Ingreso con Apple (requiere cuenta de desarrollador de Apple).
- App móvil (React Native): pantalla de ingreso + sincronización (hoy las cuentas funcionan en la web, las apps de escritorio y el APK liviano).
