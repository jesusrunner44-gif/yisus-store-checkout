# Wompi migration — deploy checklist

Fecha: 2026-08-26

Orden estricto. No saltarse pasos: si algo falla, ver "Rollback" al final.

---

## 1. Aplicar migración SQL en Supabase

En el SQL editor:
`https://supabase.com/dashboard/project/nbrcotnnuhdroetjxzip/sql`

Pegar y ejecutar el contenido de:
`scripts/migrations/003_wompi.sql`

Debe crear/agregar:
- Columnas: `payment_provider`, `wompi_transaction_id`, `wompi_reference`
- Tabla: `wompi_events`
- Índices

Verificar con:
```sql
select column_name from information_schema.columns
  where table_name = 'orders' and column_name like 'wompi%';
```

---

## 2. Agregar env vars en Vercel

Project: `yisus-store-checkout` → Settings → Environment Variables → **Production**

Agregar:

| Nombre | Valor |
|---|---|
| `WOMPI_PUBLIC_KEY` | `pub_prod_...` |
| `WOMPI_PRIVATE_KEY` | `prv_prod_...` |
| `WOMPI_INTEGRITY_SECRET` | `prod_integrity_...` |
| `WOMPI_EVENTS_SECRET` | `prod_events_...` |

Marcar como **Sensitive** las 4.

Dejar `MP_ACCESS_TOKEN` por ahora (no interfiere; se puede borrar cuando ya no haya consultas al histórico MP).

---

## 3. Deploy del código a Vercel

Desde la carpeta del repo:
```bash
git add api/ lib/ scripts/ deprecated/ package.json WOMPI-DEPLOY.md
git commit -m "feat: migrate checkout from Mercado Pago to Wompi"
git push origin main
```

Vercel hace auto-deploy. Verificar en el dashboard que el deploy termina en verde.

**Smoke test tras el deploy:**
```bash
# El endpoint viejo ya no debe existir:
curl -s -o /dev/null -w "%{http_code}\n" https://yisus-store-checkout.vercel.app/api/create-preference
# Esperado: 404

# El nuevo endpoint debe estar montado (405 porque no aceptamos GET):
curl -s -o /dev/null -w "%{http_code}\n" https://yisus-store-checkout.vercel.app/api/create-transaction
# Esperado: 405
```

---

## 4. Configurar webhook en el panel de Wompi

1. Entrar a `https://comercios.wompi.co/` con tu cuenta
2. Configuración → Eventos → **Nueva URL de eventos**
3. URL: `https://yisus-store-checkout.vercel.app/api/wompi-webhook`
4. Eventos a suscribir: al menos `transaction.updated`
5. Guardar

Wompi te dará un `Events Secret` (ya lo tienes: `prod_events_sRGNkTcRqEIExt4ghyaAdJd8pT74q01U`). El que aparezca en el panel debe **coincidir** con el que pusiste en Vercel — si no, rotarlo y actualizar Vercel.

---

## 5. Actualizar los 3 snippets en Webflow

Ir al Designer de Webflow → Publish preview.

Reemplazar el contenido de los **Embed** en cada página:

| Página | Archivo a pegar |
|---|---|
| `/gracias-pago-aprobado` | `scripts/webflow-snippets-wompi/1-gracias-pago-aprobado.html` |
| `/pago-fallido-pago-rechazado` | `scripts/webflow-snippets-wompi/2-pago-fallido-pago-rechazado.html` |
| `/pago-pendiente-pago-en-proceso` | `scripts/webflow-snippets-wompi/3-pago-pendiente-pago-en-proceso.html` |

**Publicar Webflow** después de cada cambio.

Nota: los snippets nuevos consultan `https://api.wompi.co/v1/transactions/{id}` directamente desde el navegador — no necesitan pasar por Vercel para leer el estado.

---

## 6. Actualizar el botón de checkout en Webflow

Donde hoy se llama a `/api/create-preference` con `init_point`, cambiar a `/api/create-transaction` con `checkout_url`.

Referencia: `scripts/webflow-snippets-wompi/4-checkout-button.html`

**Publicar Webflow.**

---

## 7. Test end-to-end real ($1.000–$2.000)

1. Ir a `yisusstore.com`
2. Agregar un producto barato (o crear uno de prueba de $2.000 COP con un sachet)
3. Checkout completo con tarjeta real de bajo monto
4. Verificar:
   - Redirect a `checkout.wompi.co` funciona
   - Pago se procesa
   - Redirect vuelve a `/pago-pendiente-pago-en-proceso?id=...`
   - Polling detecta APPROVED y redirige a `/gracias-pago-aprobado`
   - Email al cliente llega
   - Email interno a `ventas@yisusstore.com` llega
   - Panel admin muestra la orden con `payment_status=approved`
5. **Reversar el pago** desde el panel de Wompi (Transacciones → Reversar) para no perder el dinero

---

## 8. Rotar credenciales expuestas en chat

Después del test end-to-end exitoso:
- Wompi panel → Configuración → API Keys → **Regenerar** las 4 llaves de producción
- Actualizar las 4 env vars en Vercel con los valores nuevos
- Redeploy: `git commit --allow-empty -m "chore: rotate wompi keys" && git push`

---

## Rollback

Si algo falla catastróficamente en producción:

```bash
# 1. Restaurar archivos MP a api/
git mv deprecated/mercadopago/create-preference.js api/create-preference.js
git mv deprecated/mercadopago/mercadopago-webhook.js api/mercadopago-webhook.js
git commit -m "revert: rollback to Mercado Pago"
git push
```

Luego revertir el botón de checkout en Webflow al endpoint viejo y republicar.

Los datos ya escritos en `payment_provider='wompi'` en Supabase quedan como histórico. No borrar.

---

## Estado de deprecación de Mercado Pago

- Archivos MP → `deprecated/mercadopago/`. Ya no se despliegan.
- `MP_ACCESS_TOKEN` en Vercel → dejar por ahora, borrar cuando no se consulten órdenes MP viejas.
- Templates de email de MP siguen funcionando por compat: si `provider` no se pasa, defaultea a `mercadopago`.
