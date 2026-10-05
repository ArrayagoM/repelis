# Donaciones — cómo funcionan y qué completar

## Qué hace la app (todo automático)

- **Después de ver algo** (mínimo 20 min en la sesión) aparece un pedido chico: "¿Disfrutaste lo que viste?".
  Nunca antes de reproducir. Máximo **1 vez por semana**; si lo descartan 3 veces, **1 vez por mes**.
- **"Ya doné ❤"** activa la insignia **Supporter**: desaparecen los pedidos (botón flotante y aviso),
  aparece un corazón dorado en la barra y reciben **un agradecimiento por mes**.
  Funciona por confianza: desde el navegador no se puede verificar un aporte de Cafecito o Mercado Pago.
- **Cines:** los enlaces a entradas son siempre a los sitios oficiales, sin comisiones ni parámetros de afiliado.

## Lo único que tenés que completar a mano: la meta del mes

Archivo: `public/donation-goal.json`. Mientras `goal` sea `0`, la barra **no se muestra** (la app nunca inventa números).

```json
{
  "month": "2026-10",
  "currency": "USD",
  "goal": 30,
  "raised": 12,
  "costs": [
    { "label": "Dominio lifehigh.site", "amount": 2, "note": "prorrateado por mes" },
    { "label": "Servidor / base de datos", "amount": 10 }
  ]
}
```

- `goal`: cuánto necesitás ese mes. `raised`: lo recaudado hasta ahora (lo actualizás vos).
- `costs`: se muestra en "¿En qué se gasta?". Poné **solo gastos reales**.
- Después de editarlo, hacé commit y push: Vercel lo publica.

## Medios de cobro

Están en `src/components/DonateModal/index.jsx` (`DONATE_OPTIONS`): Cafecito (`cafecito.app/tintech`) y un link de
Mercado Pago (`link.mercadopago.com.ar/tintech`). **Verificá que el link de Mercado Pago exista y cobre**:
estaba como ejemplo en el código original.

Tené un método de reserva: procesadores como PayPal o Stripe suelen cerrar cuentas de sitios de streaming.
