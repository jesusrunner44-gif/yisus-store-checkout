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

  const updates = {
    payment_status: paymentStatus,
    mercado_pago_payment_id: String(paymentId),
  };

  if (payment.payment_type_id || payment.payment_method_id) {
    updates.payment_method = payment.payment_type_id || payment.payment_method_id;
  }
  if (payment.transaction_amount != null) {
    updates.paid_amount = payment.transaction_amount;
  }
  if (payment.currency_id) {
    updates.currency = payment.currency_id;
  }
  if (payment.installments != null) {
    updates.installments = payment.installments;
  }
  if (payment.payer?.email) {
    updates.payer_email = payment.payer.email;
  }
  if (paymentStatus === 'approved' && payment.date_approved) {
    updates.approved_at = payment.date_approved;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  await supabase.from('orders').update(updates).eq('id', orderId);

  return res.status(200).json({ received: true });
}
