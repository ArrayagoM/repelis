> **Opcional — hoy NO está desplegado ni hace falta.** La voz de las salas funciona con la señalización por la API de Life High (ver `docs/CUENTAS.md`). Este servidor queda como alternativa de tiempo real puro por WebSocket; no usa Railway necesariamente: es un Node chico que puede correr en cualquier hosting (Render, Fly, un VPS) y solo debería estar prendido cuando haya salas.

# Servidor de voz de Life High

Servicio de WebSocket que hace de "central telefónica" de las **salas**: reenvía la señalización WebRTC entre las personas de una
misma sala. El audio va **directo entre ellas** (P2P); acá no pasa ni se guarda ningún audio.

## Variables de entorno
| Variable | Qué es |
|---|---|
| `VOICE_SECRET` | **Obligatoria.** Secreto compartido con Vercel (misma variable allá). Firma los tokens de entrada y protege `/kick`. |
| `VOICE_ORIGINS` | Orígenes web permitidos, separados por coma. Por defecto `https://lifehigh.site,https://repelis.vercel.app`. |
| `ICE_SERVERS` | (Opcional) JSON con STUN/TURN que se le entrega a cada cliente. Sin TURN, ~15 % de las redes (corporativas / NAT simétrico) no podrán conectar. Ej.: `[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:host:3478","username":"u","credential":"c"}]` |
| `PORT` | Lo pone la plataforma. |

## Endpoints
- `GET /health` → `{ ok, rooms }`
- `WS /ws?token=…` → conexión de una persona (token de 5 min emitido por `/api/rooms/voice-token`).
- `POST /kick` (cabecera `x-voice-secret`) → `{ code, userId }` o `{ code, all: true }` para sacar a alguien / vaciar una sala.

## Desplegar en Railway
Servicio nuevo desde este repositorio con **Root Directory = `voice-server`** (usa el `Dockerfile` y `railway.toml`), variable `VOICE_SECRET`,
y generar un dominio público. En Vercel: `VOICE_URL=wss://<dominio>` y el mismo `VOICE_SECRET`.
