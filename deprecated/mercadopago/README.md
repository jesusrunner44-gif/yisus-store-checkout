# Mercado Pago — DEPRECATED

Archivos originales del checkout con Mercado Pago Checkout Pro.
Migración a Wompi ejecutada el 2026-08-26.

**No borrar** hasta confirmar que:
- No hay órdenes activas en estado `pending` con `payment_provider = 'mercadopago'`
- Los emails y datos históricos de MP se consultan sin problema desde el panel admin
- Han pasado al menos 30 días desde el cutover

Estos archivos ya NO se despliegan en Vercel (fuera de `api/`), y las env vars `MP_ACCESS_TOKEN` pueden retirarse cuando ya no se necesiten para consulta.
