# yisus-store-checkout

Vercel serverless API for Mercado Pago Checkout Pro — Yisus Store.

## Endpoint

### `POST /api/create-preference`

Creates a Mercado Pago payment preference and returns the checkout URLs.

#### Option 1 — Single product

```json
{
  "title": "Best Whey Chocolate",
  "price": 89900,
  "quantity": 1
}
```

#### Option 2 — Multiple products

```json
{
  "items": [
    { "title": "Best Whey Chocolate", "quantity": 1, "unit_price": 89900 },
    { "title": "Legacy Creatina", "quantity": 2, "unit_price": 85000 }
  ]
}
```

#### Response

```json
{
  "init_point": "https://www.mercadopago.com.co/checkout/v1/redirect?...",
  "sandbox_init_point": "https://sandbox.mercadopago.com.co/checkout/v1/redirect?..."
}
```

Use `init_point` in production and `sandbox_init_point` for testing.

## Setup

### 1. Clone and install

```bash
npm install
```

### 2. Environment variables

Create a `.env.local` file for local development:

```
MP_ACCESS_TOKEN=your_mercado_pago_access_token
```

In Vercel, add `MP_ACCESS_TOKEN` under **Settings → Environment Variables**.

### 3. Local development

```bash
npm run dev
```

### 4. Deploy to Vercel

```bash
vercel --prod
```

## Back URLs

| Event   | URL                                  |
|---------|--------------------------------------|
| Success | https://yisusstore.com/gracias        |
| Failure | https://yisusstore.com/pago-fallido   |
| Pending | https://yisusstore.com/pago-pendiente |

## CORS

Requests are accepted only from:
- `https://yisusstore.com`
- `https://www.yisusstore.com`
