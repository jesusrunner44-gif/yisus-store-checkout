import { createClient } from '@supabase/supabase-js';

const MP_PAYMENTS_URL = 'https://api.mercadopago.com/v1/payments';
const RESEND_API_URL = 'https://api.resend.com/emails';

function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
}

function buildEmailHtml(order) {
  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#000000;padding:32px 40px;text-align:center;">
          <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:2px;">YISUS STORE</h1>
          <p style="color:#cccccc;margin:8px 0 0;font-size:14px;">Suplementos deportivos</p>
        </td></tr>

        <!-- Confirmation banner -->
        <tr><td style="background:#00c853;padding:20px 40px;text-align:center;">
          <p style="color:#ffffff;margin:0;font-size:18px;font-weight:bold;">✓ Pedido confirmado</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:40px;">
          <p style="color:#333;font-size:16px;margin:0 0 8px;">Hola, <strong>${order.customer_name}</strong></p>
          <p style="color:#555;font-size:15px;margin:0 0 32px;">Recibimos tu pago y tu pedido ya está siendo preparado. Te avisaremos cuando sea despachado.</p>

          <!-- Order summary -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;padding:24px;margin-bottom:32px;">
            <tr><td style="padding-bottom:16px;border-bottom:1px solid #eee;">
              <p style="margin:0;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Número de pedido</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:bold;color:#000;">${order.order_number}</p>
            </td></tr>
            <tr><td style="padding:16px 0;border-bottom:1px solid #eee;">
              <p style="margin:0;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Productos</p>
              <p style="margin:4px 0 0;font-size:15px;color:#333;">${order.product_title}</p>
            </td></tr>
            <tr><td style="padding:16px 0 0;">
              <p style="margin:0;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Total pagado</p>
              <p style="margin:4px 0 0;font-size:20px;font-weight:bold;color:#000;">${formatCOP(order.paid_amount ?? order.total)}</p>
            </td></tr>
          </table>

          <!-- Shipping address -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9f9f9;border-radius:6px;padding:24px;margin-bottom:32px;">
            <tr><td>
              <p style="margin:0 0 12px;font-size:13px;color:#999;text-transform:uppercase;letter-spacing:1px;">Dirección de entrega</p>
              <p style="margin:0;font-size:15px;color:#333;line-height:1.6;">
                ${order.address}${order.neighborhood ? ', ' + order.neighborhood : ''}<br>
                ${order.city}, ${order.department}<br>
                WhatsApp: ${order.customer_phone}
              </p>
            </td></tr>
          </table>

          <!-- Message -->
          <p style="color:#555;font-size:14px;line-height:1.7;margin:0;">
            Si tienes alguna duda sobre tu pedido, contáctanos por WhatsApp. Estamos aquí para ayudarte.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#000;padding:24px 40px;text-align:center;">
          <p style="color:#888;font-size:12px;margin:0;">© 2025 Yisus Store · yisusstore.com</p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `.trim();
}

async function sendConfirmationEmail(order, resendApiKey) {
  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${resendApiKey}`,
    },
    body: JSON.stringify({
      from: 'Yisus Store <onboarding@resend.dev>',
      to: [order.customer_email],
      subject: `Pedido confirmado - ${order.order_number}`,
      html: buildEmailHtml(order),
    }),
  });

  return response.ok;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!MP_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).end();
  }

  const paymentId = req.query.id || req.body?.data?.id || req.body?.id;
  if (!paymentId) return res.status(200).end();

  const mpResponse = await fetch(`${MP_PAYMENTS_URL}/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });

  if (!mpResponse.ok) return res.status(200).end();

  const payment = await mpResponse.json();

  const orderId = payment.metadata?.order_id;
  const paymentStatus = payment.status;
  if (!orderId || !paymentStatus) return res.status(200).end();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const updates = {
    payment_status: paymentStatus,
    mercado_pago_payment_id: String(paymentId),
  };

  if (payment.payment_type_id || payment.payment_method_id) {
    updates.payment_method = payment.payment_type_id || payment.payment_method_id;
  }
  if (payment.transaction_amount != null) updates.paid_amount = payment.transaction_amount;
  if (payment.currency_id) updates.currency = payment.currency_id;
  if (payment.installments != null) updates.installments = payment.installments;
  if (payment.payer?.email) updates.payer_email = payment.payer.email;
  if (paymentStatus === 'approved' && payment.date_approved) {
    updates.approved_at = payment.date_approved;
  }

  await supabase.from('orders').update(updates).eq('id', orderId);

  // Send confirmation email only on first approval
  if (paymentStatus === 'approved' && RESEND_API_KEY) {
    const { data: order } = await supabase
      .from('orders')
      .select('order_number, product_title, total, paid_amount, customer_name, customer_email, customer_phone, address, neighborhood, city, department, email_sent_at')
      .eq('id', orderId)
      .single();

    if (order && !order.email_sent_at) {
      const sent = await sendConfirmationEmail(order, RESEND_API_KEY);
      if (sent) {
        await supabase
          .from('orders')
          .update({ email_sent_at: new Date().toISOString() })
          .eq('id', orderId);
      }
    }
  }

  return res.status(200).json({ received: true });
}
