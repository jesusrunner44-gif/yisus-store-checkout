import { Resend } from 'resend';

const FROM = 'ventas@yisusstore.com';
const INTERNAL_TO = 'ventas@yisusstore.com';

function formatCOP(amount) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(amount);
}

function customerEmailHtml(order) {
  const total = formatCOP(order.paid_amount ?? order.total);
  const address = [
    order.address,
    order.neighborhood,
    order.city,
    order.department,
  ].filter(Boolean).join(', ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Pedido confirmado</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f4;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0a0a0a;padding:28px 40px;text-align:center;">
            <p style="margin:0;font-size:22px;font-weight:900;color:#fff;letter-spacing:3px;text-transform:uppercase;">YISUS STORE</p>
            <p style="margin:6px 0 0;font-size:13px;color:#888;">Suplementos deportivos · yisusstore.com</p>
          </td>
        </tr>

        <!-- Status banner -->
        <tr>
          <td style="background:#00c853;padding:18px 40px;text-align:center;">
            <p style="margin:0;font-size:17px;font-weight:bold;color:#fff;">✅ ¡Tu pedido fue confirmado!</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 6px;font-size:16px;color:#222;">Hola, <strong>${order.customer_name}</strong></p>
            <p style="margin:0 0 28px;font-size:15px;color:#555;line-height:1.6;">
              Recibimos tu pago exitosamente. Tu pedido ya está siendo preparado y te avisaremos cuando sea despachado.
            </p>

            <!-- Order info -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;border-radius:8px;margin-bottom:24px;">
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #eee;">
                  <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Número de pedido</p>
                  <p style="margin:5px 0 0;font-size:20px;font-weight:bold;color:#000;">${order.order_number}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;border-bottom:1px solid #eee;">
                  <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Productos</p>
                  <p style="margin:5px 0 0;font-size:15px;color:#333;line-height:1.5;">${order.product_title}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Total pagado</p>
                  <p style="margin:5px 0 0;font-size:22px;font-weight:bold;color:#00c853;">${total}</p>
                </td>
              </tr>
            </table>

            <!-- Shipping -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;border-radius:8px;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 8px;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Dirección de entrega</p>
                  <p style="margin:0;font-size:15px;color:#333;line-height:1.7;">
                    ${address}<br/>
                    📱 WhatsApp: ${order.customer_phone}
                  </p>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:14px;color:#666;line-height:1.7;">
              Gracias por tu compra. Si tienes alguna pregunta, escríbenos por WhatsApp y te ayudamos de inmediato. ¡Que disfrutes tus suplementos! 💪
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#0a0a0a;padding:20px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#666;">© 2025 Yisus Store · yisusstore.com</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function internalEmailHtml(order, payment) {
  const total = formatCOP(order.paid_amount ?? order.total);
  const paymentDate = payment.date_approved
    ? new Date(payment.date_approved).toLocaleString('es-CO', { timeZone: 'America/Bogota' })
    : new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  const address = [
    order.address,
    order.neighborhood,
    order.city,
    order.department,
  ].filter(Boolean).join(', ');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>Nueva venta</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f4f4f4;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px;width:100%;background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <tr>
          <td style="background:#0a0a0a;padding:24px 40px;">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#fff;">🛒 Nueva venta — Yisus Store</p>
            <p style="margin:5px 0 0;font-size:13px;color:#888;">${paymentDate}</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px 40px;">

            <p style="margin:0 0 20px;font-size:20px;font-weight:bold;color:#00c853;">${order.order_number}</p>

            <!-- Customer -->
            <h3 style="margin:0 0 12px;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Cliente</h3>
            <table width="100%" cellpadding="6" cellspacing="0" style="font-size:14px;color:#333;margin-bottom:24px;border-top:1px solid #eee;">
              <tr style="border-bottom:1px solid #eee;">
                <td style="color:#999;padding:8px 0;width:38%;">Nombre</td>
                <td><strong>${order.customer_name}</strong></td>
              </tr>
              <tr style="border-bottom:1px solid #eee;">
                <td style="color:#999;padding:8px 0;">Email</td>
                <td>${order.customer_email}</td>
              </tr>
              <tr>
                <td style="color:#999;padding:8px 0;">WhatsApp</td>
                <td>${order.customer_phone}</td>
              </tr>
            </table>

            <!-- Shipping -->
            <h3 style="margin:0 0 8px;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Dirección de envío</h3>
            <p style="margin:0 0 24px;font-size:14px;color:#333;line-height:1.7;">${address}</p>

            <!-- Products -->
            <h3 style="margin:0 0 8px;font-size:12px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Productos</h3>
            <p style="margin:0 0 24px;font-size:14px;color:#333;">${order.product_title}</p>

            <!-- Payment summary -->
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f9f9f9;border-radius:8px;">
              <tr>
                <td style="padding:16px 20px;border-bottom:1px solid #eee;">
                  <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Total pagado</p>
                  <p style="margin:4px 0 0;font-size:22px;font-weight:bold;color:#000;">${total}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;border-bottom:1px solid #eee;">
                  <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">ID Mercado Pago</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#333;font-family:monospace;">${payment.id}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 20px;">
                  <p style="margin:0;font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:1px;">Fecha de pago</p>
                  <p style="margin:4px 0 0;font-size:13px;color:#333;">${paymentDate}</p>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <tr>
          <td style="background:#f0f0f0;padding:16px 40px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#aaa;">Notificación interna — Yisus Store</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function sendOrderEmails({ order, payment, resendApiKey }) {
  const resend = new Resend(resendApiKey);

  await Promise.all([
    resend.emails.send({
      from: FROM,
      to: [order.customer_email],
      subject: `✅ Pedido confirmado #${order.order_number}`,
      html: customerEmailHtml(order),
    }),
    resend.emails.send({
      from: FROM,
      to: [INTERNAL_TO],
      subject: `🛒 Nueva venta #${order.order_number}`,
      html: internalEmailHtml(order, payment),
    }),
  ]);
}
