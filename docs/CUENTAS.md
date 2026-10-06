# Cuentas de usuario (opcionales) y sincronización

Registro e ingreso con mail y contraseña. Sirve para sincronizar **Mi lista, Continuar viendo, avisos, logros y Supporter**
entre dispositivos. Sin cuenta, todo sigue funcionando igual (guardado en el dispositivo).

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
| `RESEND_API_KEY` | No* | Clave de [Resend](https://resend.com) (gratis). *Sin ella no hay mails: no se puede confirmar el mail ni recuperar la contraseña. |
| `MAIL_FROM` | No | Remitente, ej. `Life High <avisos@tudominio.com>`. Sin dominio verificado en Resend solo se puede mandar a tu propio mail (`onboarding@resend.dev`). |
| `SITE_URL` | No | URL pública para los enlaces de los mails (por defecto `https://repelis.vercel.app`). Poné `https://lifehigh.site` cuando el dominio funcione. |

Cargalas en **Production, Preview y Development** y hacé **Redeploy**.

### Contraseña con caracteres especiales

Si la clave de la base tiene símbolos (`# @ / : ? %`), en la URL hay que escribirlos codificados (`#` → `%23`, `@` → `%40`, `/` → `%2F`, `:` → `%3A`).
Lo más simple: usar la contraseña **autogenerada** de Atlas (solo letras y números).

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

- Ingreso con Google/Apple (requiere configurar sus consolas).
- App móvil (React Native): pantalla de ingreso + sincronización (hoy las cuentas funcionan en la web, las apps de escritorio y el APK liviano).
