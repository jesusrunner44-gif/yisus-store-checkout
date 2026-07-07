import { createClient } from '@supabase/supabase-js';

const MP_PAYMENTS_URL = 'https://api.mercadopago.com/v1/payments';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

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

  await supabase
    .from('orders')
    .update({
      mercado_pago_payment_id: String(paymentId),
      payment_status: paymentStatus,
    })
    .eq('id', orderId);

  return res.status(200).json({ received: true });
}
