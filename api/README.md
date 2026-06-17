# API · Backend de visitas

Edge Functions de Vercel (serverless, sin servidor que mantener).

## Endpoints

- **POST `/api/track`** — público, registra una visita usando los geo headers
  que Vercel inyecta automáticamente (`x-vercel-ip-country`, `x-vercel-ip-city`,
  etc.). NO guarda IP cruda — solo país/ciudad/coords agregadas.
- **GET `/api/visits`** — protegido con header `x-admin-pin`. Devuelve
  agregado de visitas por ciudad + stats (hoy, 7 días, uniques).

## Setup en Vercel (1 vez, 3 minutos)

### 1. Activar Vercel KV (gratis, 30k requests/mes)

1. Abrí https://vercel.com/arrayagom/repelis/stores
2. Click **Create** → **KV (Redis)**
3. Name: `lifehigh-visits` (cualquiera)
4. Region: **`iad1`** (USA East) o la más cercana
5. Click **Create**
6. **Connect Project** → seleccioná `repelis` → **Connect**

Vercel automáticamente agrega estas env vars al proyecto:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`
- `KV_URL`

### 2. Configurar el PIN admin para `/api/visits`

1. https://vercel.com/arrayagom/repelis/settings/environment-variables
2. **Add New**
3. Name: `ADMIN_PIN`
4. Value: el PIN que ya configuraste como `VITE_ADMIN_PIN`
5. Environments: Production + Preview + Development
6. **Save**

### 3. Redeploy

Después de agregar env vars hace falta redeploy para que las tomen:

1. https://vercel.com/arrayagom/repelis/deployments
2. Último deploy → **⋯** → **Redeploy**

## Verificación

Después del redeploy:

1. Abrí `https://repelis.vercel.app/` (eso dispara una visita)
2. Andá a `/admin` → tab Analytics
3. Click **"Cargar visitas reales"**
4. Tipeá tu PIN
5. El mapa cambia las burbujas demo por las reales (1 sola, la tuya)
6. A medida que entren más usuarios desde distintas ciudades, vas a ver más burbujas

## Costos

| Recurso | Free tier |
|---|---|
| Vercel KV (Upstash Redis) | 30k requests/mes |
| Vercel Edge Functions | 100k invocations/mes |
| Vercel Analytics | 100k visits/mes |

Con eso aguantás ~30k visitas/mes sin pagar nada.

## Privacidad / GDPR / Ley 25.326

- **NO guardamos IP cruda** — Vercel nos da el país/ciudad ya geolocalizado
- **NO usamos cookies** — el contador único usa un hash anónimo de UA + lang + día
- **NO requiere consentimiento del usuario** — la geolocalización por IP es
  considerada metadato de transporte, no dato personal (jurisprudencia AAIP)
- Datos retenidos: solo agregados por ciudad. Uniques expiran a los 7 días.
