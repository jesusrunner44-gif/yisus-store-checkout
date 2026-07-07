import { Resend } from 'resend';

const FROM = 'ventas@yisusstore.com';
const INTERNAL_TO = 'ventas@yisusstore.com';

function formatNumber(amount) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(amount ?? 0);
}

function fill(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

// ─── Templates ───────────────────────────────────────────────────────────────

const CUSTOMER_ORDER_CONFIRMED = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
body{margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111}
.wrap{max-width:640px;margin:0 auto;background:#fff}
.header{padding:28px 32px;border-bottom:1px solid #eee}
.brand{font-size:26px;font-weight:900;color:#ef3328}
.content{padding:32px}
h1{font-size:28px;line-height:1.15;margin:0 0 12px;color:#111}
p{font-size:16px;line-height:1.55;margin:0 0 16px;color:#333}
.card{border:1px solid #eee;border-radius:16px;padding:20px;margin:20px 0;background:#fff}
.muted{color:#777;font-size:14px}
.pill{display:inline-block;background:#fff1ef;color:#ef3328;padding:8px 12px;border-radius:999px;font-weight:800;font-size:13px}
.btn{display:inline-block;background:#ef3328;color:#fff!important;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;margin-top:8px}
table{width:100%;border-collapse:collapse}
td,th{padding:10px 0;border-bottom:1px solid #eee;font-size:15px;text-align:left;vertical-align:top}
th{color:#777;font-weight:700;font-size:13px;text-transform:uppercase}
.total{font-size:24px;font-weight:900;color:#ef3328}
.footer{padding:24px 32px;background:#111;color:#fff}
.footer p{color:#ddd;font-size:13px;margin:0 0 8px}
@media(max-width:600px){.content,.header,.footer{padding:24px 20px}h1{font-size:24px}}
</style></head><body>
<div class="wrap"><div class="header"><div class="brand">Yisus Store</div></div><div class="content">
<span class="pill">Pago confirmado</span>
<h1>¡Gracias por tu compra, {{customer_name}}!</h1>
<p>Recibimos tu pago correctamente. Ya estamos preparando tu pedido.</p>
<div class="card"><p class="muted">Número de pedido</p><h2 style="margin:0;">#{{order_number}}</h2></div>
<div class="card"><h2 style="margin-top:0;">Resumen del pedido</h2><table><tr><th>Productos</th></tr><tr><td>{{products}}</td></tr></table><p class="muted" style="margin-top:18px;">Total pagado</p><div class="total">COP {{total}}</div></div>
<div class="card"><h2 style="margin-top:0;">Dirección de envío</h2><p>{{customer_name}}<br>{{address}}<br>{{neighborhood}}<br>{{city}}, {{department}}<br>WhatsApp: {{phone}}</p></div>
<div class="card"><h2 style="margin-top:0;">¿Qué sigue?</h2><p>✅ Pedido confirmado<br>📦 Preparando pedido<br>🚚 En camino próximamente<br>📍 Entrega</p><p>Te enviaremos otro correo cuando el pedido sea despachado con tu número de guía.</p></div>
<a class="btn" href="https://wa.me/573127932678">Contactar por WhatsApp</a>
</div><div class="footer"><p><strong>Yisus Store</strong></p><p>ventas@yisusstore.com · WhatsApp +57 312 793 2678</p></div></div>
</body></html>`;

const INTERNAL_NEW_SALE = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
body{margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111}
.wrap{max-width:640px;margin:0 auto;background:#fff}
.header{padding:28px 32px;border-bottom:1px solid #eee}
.brand{font-size:26px;font-weight:900;color:#ef3328}
.content{padding:32px}
h1{font-size:28px;line-height:1.15;margin:0 0 12px;color:#111}
p{font-size:16px;line-height:1.55;margin:0 0 16px;color:#333}
.card{border:1px solid #eee;border-radius:16px;padding:20px;margin:20px 0;background:#fff}
.muted{color:#777;font-size:14px}
.pill{display:inline-block;background:#fff1ef;color:#ef3328;padding:8px 12px;border-radius:999px;font-weight:800;font-size:13px}
.btn{display:inline-block;background:#ef3328;color:#fff!important;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;margin-top:8px}
table{width:100%;border-collapse:collapse}
td,th{padding:10px 0;border-bottom:1px solid #eee;font-size:15px;text-align:left;vertical-align:top}
th{color:#777;font-weight:700;font-size:13px;text-transform:uppercase}
.total{font-size:24px;font-weight:900;color:#ef3328}
.footer{padding:24px 32px;background:#111;color:#fff}
.footer p{color:#ddd;font-size:13px;margin:0 0 8px}
@media(max-width:600px){.content,.header,.footer{padding:24px 20px}h1{font-size:24px}}
</style></head><body>
<div class="wrap"><div class="header"><div class="brand">Yisus Store</div></div><div class="content">
<span class="pill">Nueva venta</span><h1>🛒 Nueva venta #{{order_number}}</h1>
<div class="card"><h2 style="margin-top:0;">Cliente</h2><p><strong>{{customer_name}}</strong><br>{{customer_email}}<br>WhatsApp: {{phone}}</p></div>
<div class="card"><h2 style="margin-top:0;">Productos</h2><p>{{products}}</p><p class="muted">Total pagado</p><div class="total">COP {{total}}</div></div>
<div class="card"><h2 style="margin-top:0;">Dirección</h2><p>{{address}}<br>Barrio: {{neighborhood}}<br>{{city}}, {{department}}<br>Complemento: {{extra_address}}<br>Notas: {{notes}}</p></div>
<div class="card"><h2 style="margin-top:0;">Pago</h2><p>Estado: <strong>{{payment_status}}</strong><br>ID Mercado Pago: {{mercado_pago_payment_id}}<br>Método: {{payment_method}}</p></div>
</div><div class="footer"><p>Notificación interna automática de Yisus Store.</p></div></div>
</body></html>`;

const CUSTOMER_ORDER_SHIPPED = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
body{margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111}
.wrap{max-width:640px;margin:0 auto;background:#fff}
.header{padding:28px 32px;border-bottom:1px solid #eee}
.brand{font-size:26px;font-weight:900;color:#ef3328}
.content{padding:32px}
h1{font-size:28px;line-height:1.15;margin:0 0 12px;color:#111}
p{font-size:16px;line-height:1.55;margin:0 0 16px;color:#333}
.card{border:1px solid #eee;border-radius:16px;padding:20px;margin:20px 0;background:#fff}
.muted{color:#777;font-size:14px}
.pill{display:inline-block;background:#fff1ef;color:#ef3328;padding:8px 12px;border-radius:999px;font-weight:800;font-size:13px}
.btn{display:inline-block;background:#ef3328;color:#fff!important;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;margin-top:8px}
table{width:100%;border-collapse:collapse}
td,th{padding:10px 0;border-bottom:1px solid #eee;font-size:15px;text-align:left;vertical-align:top}
th{color:#777;font-weight:700;font-size:13px;text-transform:uppercase}
.total{font-size:24px;font-weight:900;color:#ef3328}
.footer{padding:24px 32px;background:#111;color:#fff}
.footer p{color:#ddd;font-size:13px;margin:0 0 8px}
@media(max-width:600px){.content,.header,.footer{padding:24px 20px}h1{font-size:24px}}
</style></head><body>
<div class="wrap"><div class="header"><div class="brand">Yisus Store</div></div><div class="content">
<span class="pill">Pedido enviado</span><h1>🚚 Tu pedido ya va en camino</h1>
<p>Hola {{customer_name}}, tu pedido #{{order_number}} ya fue entregado a la transportadora.</p>
<div class="card"><h2 style="margin-top:0;">Datos de envío</h2><p>Transportadora: <strong>{{shipping_company}}</strong><br>Número de guía: <strong>{{tracking_number}}</strong></p><a class="btn" href="{{tracking_url}}">Rastrear pedido</a></div>
<div class="card"><h2 style="margin-top:0;">Dirección</h2><p>{{address}}<br>{{city}}, {{department}}</p></div>
</div><div class="footer"><p>Gracias por comprar en Yisus Store.</p></div></div>
</body></html>`;

const CUSTOMER_ORDER_DELIVERED = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
body{margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#111}
.wrap{max-width:640px;margin:0 auto;background:#fff}
.header{padding:28px 32px;border-bottom:1px solid #eee}
.brand{font-size:26px;font-weight:900;color:#ef3328}
.content{padding:32px}
h1{font-size:28px;line-height:1.15;margin:0 0 12px;color:#111}
p{font-size:16px;line-height:1.55;margin:0 0 16px;color:#333}
.card{border:1px solid #eee;border-radius:16px;padding:20px;margin:20px 0;background:#fff}
.muted{color:#777;font-size:14px}
.pill{display:inline-block;background:#fff1ef;color:#ef3328;padding:8px 12px;border-radius:999px;font-weight:800;font-size:13px}
.btn{display:inline-block;background:#ef3328;color:#fff!important;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:800;margin-top:8px}
table{width:100%;border-collapse:collapse}
td,th{padding:10px 0;border-bottom:1px solid #eee;font-size:15px;text-align:left;vertical-align:top}
th{color:#777;font-weight:700;font-size:13px;text-transform:uppercase}
.total{font-size:24px;font-weight:900;color:#ef3328}
.footer{padding:24px 32px;background:#111;color:#fff}
.footer p{color:#ddd;font-size:13px;margin:0 0 8px}
@media(max-width:600px){.content,.header,.footer{padding:24px 20px}h1{font-size:24px}}
</style></head><body>
<div class="wrap"><div class="header"><div class="brand">Yisus Store</div></div><div class="content">
<span class="pill">Pedido entregado</span><h1>🎉 Tu pedido fue entregado</h1>
<p>Hola {{customer_name}}, esperamos que disfrutes mucho tus productos.</p>
<div class="card"><h2 style="margin-top:0;">Pedido #{{order_number}}</h2><p>{{products}}</p></div>
<p>Si tuviste algún inconveniente, responde este correo o escríbenos por WhatsApp.</p>
<a class="btn" href="https://yisusstore.com/">Volver a comprar</a>
</div><div class="footer"><p>Gracias por confiar en Yisus Store ❤️</p></div></div>
</body></html>`;

// ─── Email senders ────────────────────────────────────────────────────────────

export async function sendOrderEmails({ order, payment, resendApiKey }) {
  const resend = new Resend(resendApiKey);

  const vars = {
    customer_name: order.customer_name,
    order_number: order.order_number,
    products: order.product_title,
    total: formatNumber(order.paid_amount ?? order.total),
    address: order.address,
    neighborhood: order.neighborhood ?? '',
    city: order.city,
    department: order.department,
    phone: order.customer_phone,
    customer_email: order.customer_email,
    extra_address: order.extra_address ?? '',
    notes: order.notes ?? '',
    payment_status: payment.status,
    mercado_pago_payment_id: String(payment.id),
    payment_method: payment.payment_type_id || payment.payment_method_id || '',
  };

  await Promise.all([
    resend.emails.send({
      from: FROM,
      to: [order.customer_email],
      subject: `✅ Pedido confirmado #${order.order_number}`,
      html: fill(CUSTOMER_ORDER_CONFIRMED, vars),
    }),
    resend.emails.send({
      from: FROM,
      to: [INTERNAL_TO],
      subject: `🛒 Nueva venta #${order.order_number}`,
      html: fill(INTERNAL_NEW_SALE, vars),
    }),
  ]);
}

export async function sendShippedEmail({ order, resendApiKey }) {
  const resend = new Resend(resendApiKey);

  await resend.emails.send({
    from: FROM,
    to: [order.customer_email],
    subject: `🚚 Tu pedido #${order.order_number} ya va en camino`,
    html: fill(CUSTOMER_ORDER_SHIPPED, {
      customer_name: order.customer_name,
      order_number: order.order_number,
      shipping_company: order.shipping_company ?? '',
      tracking_number: order.tracking_number ?? '',
      tracking_url: order.tracking_url ?? 'https://yisusstore.com',
      address: order.address,
      city: order.city,
      department: order.department,
    }),
  });
}

export async function sendDeliveredEmail({ order, resendApiKey }) {
  const resend = new Resend(resendApiKey);

  await resend.emails.send({
    from: FROM,
    to: [order.customer_email],
    subject: `🎉 Tu pedido #${order.order_number} fue entregado`,
    html: fill(CUSTOMER_ORDER_DELIVERED, {
      customer_name: order.customer_name,
      order_number: order.order_number,
      products: order.product_title,
    }),
  });
}
