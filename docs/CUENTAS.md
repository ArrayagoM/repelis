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

## Comunidad (`/comunidad`)

Perfiles con @usuario, listas públicas (zapping, plan de finde, maratón…), me gusta, seguir y un feed. **Mirar es libre; publicar, dar me gusta o seguir pide cuenta.**

- **Páginas:** `/comunidad` (Populares · Nuevas · Siguiendo), `/lista/:id`, `/lista/nueva`, `/lista/:id/editar`, `/u/:handle`, `/perfil`. En las fichas de película/serie hay "Agregar a una lista".
- **API:** `api/social/[action].js` → `api/_lib/socialApi.js`. Reglas compartidas cliente/servidor en `src/lib/socialRules.js` (el servidor vuelve a validar todo).
- **Datos (MongoDB):** colecciones `profiles`, `lists`, `likes`, `follows`, `reports` (índices en `socialStore.js`).
- **Límites:** gratis 3 listas × 50 títulos; Premium 100 × 200 y listas privadas (el campo `user.premium` existe, aún sin cobro). Sin links en ningún texto. Cuenta nueva sin mail verificado espera 1 h para publicar. @usuario cambia 1 vez cada 30 días.
- **Moderación:** botón "Reportar" en cada lista; a los **3 reportes de personas distintas** se oculta sola. En `/panel` (solo fundador) hay números de comunidad y la cola de reportes: descartar / ocultar / borrar.
- **Borrar cuenta** elimina también perfil, listas, me gusta, seguimientos y reportes de esa persona.
- **Probar contra Mongo real** (base temporal que se borra sola): `$env:MONGODB_URI = "<uri>"; node scripts/smoke-social.mjs`.

## Opiniones, avisos, push y resumen por mail

- **Opiniones y comentarios:** en cada película/serie (una opinión por persona, con estrellas 1–5 opcionales) y en cada lista pública (varios comentarios). Mismas reglas que las listas: sin links, cuenta + perfil, 20 por hora, 3 reportes distintos lo ocultan, la dueña de la lista y el fundador pueden borrar. Los reportes de comentarios aparecen junto a los de listas en `/panel`.
- **Avisos (`/avisos`, campanita en el menú):** alguien te sigue, da me gusta o comenta una lista tuya, o alguien que seguís publica una lista nueva. Duran 60 días. No se repiten (clave única por evento).
- **Push del navegador (Web Push):** botón en `/avisos`. Variables de Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (generarlas con `node -e "console.log(require('web-push').generateVAPIDKeys())"`) y opcional `VAPID_SUBJECT`. Sin ellas el push queda apagado y todo lo demás sigue. Las suscripciones vencidas (404/410) se borran solas.
- **Resumen diario por mail:** opt-in en `/avisos`. Lo manda la tarea programada `/api/cron/digest` (`vercel.json → crons`, 13:00 UTC) y está protegida con `CRON_SECRET`. Solo a mails confirmados y solo si hubo novedades.
- **Retención (panel):** se guardan solo los *días* en que cada cuenta abrió la app (`seenDays`, ~4 meses). El panel muestra activas hoy/semana/mes, pegajosidad y el retorno al día 1/7/30 por cohorte semanal, sin contar al fundador.

## Mails (info@lifehigh.site)

Plantillas en `api/_lib/emailTemplates.js` (verificar mail, restablecer clave, bienvenida, aviso de cambio de clave, cuenta eliminada, actividad) y envío con Resend en `api/_lib/mailer.js`. Remitente `Life High <info@lifehigh.site>` con responder-a `info@lifehigh.site`.

Para activarlos:
1. Resend → Domains → `lifehigh.site` (región São Paulo): copiar los 4 registros DNS (DKIM `TXT resend._domainkey`, `CNAME rsend`, `CNAME send`, DMARC `TXT _dmarc`) al DNS del dominio (hoy Namecheap) y tocar *Verify*.
2. Resend → API Keys → crear una clave (permiso *Sending access*, dominio `lifehigh.site`) y cargarla en Vercel como `RESEND_API_KEY` (Production).
3. Variables opcionales: `MAIL_FROM`, `MAIL_REPLY_TO`, `SITE_URL`.

## Salas (cine digital) — fase 1

**Sin formularios:** en cada ficha de película/serie hay un botón **"Iniciar sala en grupo"** (con cuenta, un toque abre la sala y entra). El **@usuario se crea solo** la primera vez que alguien entra a una sala, opina o arma una lista (`api/_lib/autoProfile.js`: sale del nombre de la cuenta, nunca del mail, único y editable en `/perfil`).

`/salas` (crear / entrar con enlace o código / mis salas) y `/sala/<código>`. Cada sala tiene un código de 7 caracteres, un anfitrión, una película opcional y un horario opcional con **cuenta regresiva común** (el reloj del cliente se alinea con el del servidor). Hasta 12 personas, chat, 6 reacciones animadas, lista de conectados y, para el anfitrión, cambiar horario, sacar gente y cerrar (el fundador también puede cerrar/sacar).

- **Cada quien reproduce la película en su pantalla** (los reproductores son de terceros y no se pueden sincronizar): la sala sirve para coordinar y charlar. La voz es la fase 2.
- **API:** `api/rooms/[action].js` → `api/_lib/roomsApi.js`; datos en `rooms`, `room_messages`, `room_members` (`roomsStore.js`); reglas compartidas en `src/lib/roomRules.js`.
- **Transporte:** consultas frecuentes (`POST sync`, que además es el latido de presencia): 2,5 s con charla, 5 s en calma, 15 s con la pestaña oculta. Es lo que más gasta del plan gratis de Vercel: si crece, cambiar `useRoom` por un servicio de tiempo real (Ably/LiveKit) sin tocar el resto.
- **Límites:** 3 salas abiertas por persona, 5 creaciones/hora, 8 mensajes cada 10 s, 300 caracteres, sin links, una sala vive 12 h y se borra con todo 24 h después.
- Borrar la cuenta borra sus salas, su presencia y sus mensajes.

### Voz (fase 2)
Llamada de voz dentro de la sala, **WebRTC en malla**: el audio va directo entre las personas (hasta 12, solo audio) y **no pasa por ningún servidor nuestro**. Para armar cada conexión solo se intercambian unos pocos mensajes chicos ("señales": oferta, respuesta y candidatos ICE) **por la misma API de salas**: no hay servidor extra, nada prendido, ni costo adicional.

- **API:** `POST /api/rooms/voice` (entrar/salir de la llamada y silenciar; devuelve quiénes están y los servidores ICE), `POST /api/rooms/signal` (mandar una señal a otra persona de la llamada) y `POST /api/rooms/signals` (recoger las propias; sirve además de latido). Buzón efímero en `room_signals` (las señales vencen al minuto). Estado de voz por persona en `room_members.voice`.
- **Cliente:** `src/lib/voice.js`. Consulta señales cada 0,7 s mientras conecta o cuando entra alguien y cada 4 s cuando todo está estable. Siempre llama la persona que entró después (no se cruzan ofertas). Detección de "hablando" local (anillo verde), silenciar con el micrófono.
- **Límites:** 120 cambios de estado por hora y 150 señales cada 10 s por persona, señales de hasta 8 KB, solo entre personas que están en la llamada.
- **Redes difíciles:** por defecto se usa STUN público (alcanza para la mayoría). Para el ~15 % de redes que bloquean la conexión directa se puede sumar un servidor **TURN** con la variable `ICE_SERVERS` (JSON, `turn:`/`turns:`/`stun:`). `VOICE_DISABLED=1` apaga la voz.
- **Opcional, no desplegado:** `voice-server/` es un servidor de WebSocket equivalente para tener señalización en tiempo real pura; hoy no hace falta (se puede alojar gratis en Cloudflare Workers o Render si algún día se quiere).

### Ver la película al mismo tiempo (sincronía)
Los reproductores son de terceros (iframes): **no se pueden controlar desde afuera** (no aceptan pausar ni saltar). Lo que se hace para acercar a todos:
1. **Arranque a la hora:** si la sala tiene película y horario, a la hora exacta (reloj del servidor) se abre el reproductor solo para todos (casilla "Abrir la película sola", activada por defecto).
2. **Cuenta regresiva común (8 s):** el anfitrión toca el cronómetro y todos ven "8…1 ¡PLAY!" llegar a cero a la vez (alineada con el reloj del servidor, con pitidos) y dan play juntos. Sirve con cualquier reproductor y también para reanudar después de una pausa.
3. **Minuto de cada persona:** si el reproductor informa su posición (mensajes `PLAYER_EVENT` con `currentTime`; confirmado en VidLink, ver `src/lib/playback.js`), se envía en cada consulta de la sala y cada quien ve "Sincronizado / +N s / −N s" respecto del anfitrión con instrucciones: "pausá N s" (con cuenta propia) o "llevá tu video al minuto mm:ss".
- **Límite honesto:** no hay forma de forzar el video ajeno; la precisión depende de la conexión y del servidor de video de cada quien. Si un reproductor no informa el minuto, queda la cuenta regresiva.
- Posición: `room_members.pos` (vence a los 20 s). Cuenta regresiva: `POST /api/rooms/countdown` (5–15 s, 6 por minuto), guarda `room.sync = { id, at, seconds }`.

## Probar

- **Local:** `npm run dev` incluye una API de cuentas **en memoria** (`scripts/dev-api.js`); los mails se imprimen en la terminal.
- **Producción:** `GET /api/auth/status` → `{"enabled":true,"mail":false|true}`.
- **Tests:** `npx vitest run` (la lógica de cuentas, la fusión y el cliente están cubiertos).

## Pendiente / ideas

- Ingreso con Apple (requiere cuenta de desarrollador de Apple).
- App móvil (React Native): pantalla de ingreso + sincronización (hoy las cuentas funcionan en la web, las apps de escritorio y el APK liviano).
