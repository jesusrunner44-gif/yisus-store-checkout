// TEMPORARY — admin endpoint to simulate a Mercado Pago webhook.
// Marks an order as 'approved' with fake payment data and sends confirmation emails.
// Auth: requires the SUPABASE_SERVICE_ROLE_KEY as x-service-key header.
// Remove this file once the checkout has been tested with a real payment.

import { createClient } from '@supabase/supabase-js';
import { sendOrderEmails } from '../../lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server env not configured.' });
  }

  const providedKey = req.headers['x-service-key'];
  if (providedKey !== SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(401).json({ error: 'Unauthorized.' });
  }

  const orderNumber = req.body?.order_number;
  if (!orderNumber) return res.status(400).json({ error: 'Missing order_number.' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: order, error: fetchErr } = await supabase
    .from('orders')
    .select('*')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (fetchErr) return res.status(500).json({ error: 'Lookup failed.', details: fetchErr.message });
  if (!order) return res.status(404).json({ error: 'Order not found.' });

  const simulatedPayment = {
    id: `SIMULATED-${Date.now()}`,
    status: 'approved',
    transaction_amount: order.total,
    currency_id: 'COP',
    installments: 1,
    payment_type_id: 'credit_card',
    payment_method_id: 'master',
    payer: { email: order.customer_email },
    date_approved: new Date().toISOString(),
  };

  const updates = {
    payment_status: simulatedPayment.status,
    mercado_pago_payment_id: simulatedPayment.id,
    payment_method: simulatedPayment.payment_type_id,
    paid_amount: simulatedPayment.transaction_amount,
    currency: simulatedPayment.currency_id,
    installments: simulatedPayment.installments,
    payer_email: simulatedPayment.payer.email,
    approved_at: simulatedPayment.date_approved,
  };

  const { error: updErr } = await supabase.from('orders').update(updates).eq('id', order.id);
  if (updErr) return res.status(500).json({ error: 'Update failed.', details: updErr.message });

  let emailResult = 'skipped (no RESEND_API_KEY)';
  if (RESEND_API_KEY && !order.email_sent_at) {
    try {
      const merged = { ...order, ...updates };
      await sendOrderEmails({ order: merged, payment: simulatedPayment, resendApiKey: RESEND_API_KEY });
      await supabase
        .from('orders')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', order.id);
      emailResult = 'sent';
    } catch (err) {
      emailResult = `failed: ${err.message}`;
    }
  } else if (order.email_sent_at) {
    emailResult = 'skipped (already sent)';
  }

  return res.status(200).json({
    simulated: true,
    order_number: orderNumber,
    payment_status: updates.payment_status,
    email: emailResult,
  });
}
