# API · Backend de visitas

Edge Functions de Vercel + Upstash Redis (gratis, sin marketplace).

## Setup en 1 minuto (sin Vercel marketplace)

### Paso 1: crear DB en Upstash (gratis, 1 click)

1. Abrí **https://console.upstash.com** (login con GitHub o email)
2. **Create Database** → tipo **Redis** → región más cercana → **Create**
3. En la página de la DB, scroll hasta **REST API** → copiá:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

### Paso 2: pegarlas en Vercel

1. Abrí https://vercel.com/arrayagom/repelis/settings/environment-variables
2. **Add New**:
   - Name: `UPSTASH_REDIS_REST_URL`
   - Value: lo que copiaste
   - Environments: Production + Preview + Development
3. **Add New** otra vez:
   - Name: `UPSTASH_REDIS_REST_TOKEN`
   - Value: el token
   - Environments: los 3
4. **Add New** una más:
   - Name: `ADMIN_PIN`
   - Value: tu PIN admin (el mismo que usás para entrar a /admin)
   - Environments: los 3

### Paso 3: Redeploy

https://vercel.com/arrayagom/repelis/deployments → último → **⋯** → **Redeploy**

## Verificación

1. Entrá a `https://repelis.vercel.app/` (eso dispara una visita)
2. Andá a `/admin` → tab Analytics
3. El mapa ahora debería mostrar tu ciudad con la burbuja dorada
4. Auto-refresh cada 30s

## Costos

| Recurso | Free tier |
|---|---|
| Upstash Redis | 10k comandos/día (~300k visits/mes) |
| Vercel Edge Functions | 100k invocations/mes |
| Vercel Analytics | 100k visits/mes |

## Privacidad

- NO guardamos IP cruda
- Vercel nos da el país/ciudad ya geolocalizado vía headers
- Uniques anónimos con hash UA+lang+día, expiran a los 7 días
- Cumple Ley 25.326 + GDPR sin requerir consentimiento explícito
