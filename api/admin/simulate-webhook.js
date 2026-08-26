// TEMPORARY — admin endpoint to simulate an approved payment without
// going through the payment gateway. Marks an order as 'approved' with
// simulated Wompi data and sends confirmation emails.
// Auth: requires the SUPABASE_SERVICE_ROLE_KEY as x-service-key header.
// Remove this file once the checkout has been fully tested in production.

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

  const provider = order.payment_provider || 'wompi';
  const simulatedTxnId = `SIMULATED-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const simulatedPayment = {
    id: simulatedTxnId,
    status: 'approved',
    payment_type_id: 'CARD',
    payment_method_id: 'CARD',
    payer: { email: order.customer_email },
  };

  const updates = {
    payment_status: 'approved',
    payment_method: 'CARD',
    paid_amount: order.total,
    currency: order.currency || 'COP',
    payer_email: order.customer_email,
    approved_at: nowIso,
  };

  if (provider === 'wompi') {
    updates.payment_provider = 'wompi';
    updates.wompi_transaction_id = simulatedTxnId;
    updates.wompi_reference = orderNumber;
  } else {
    updates.mercado_pago_payment_id = simulatedTxnId;
  }

  const { error: updErr } = await supabase.from('orders').update(updates).eq('id', order.id);
  if (updErr) return res.status(500).json({ error: 'Update failed.', details: updErr.message });

  let emailResult = 'skipped (no RESEND_API_KEY)';
  if (RESEND_API_KEY && !order.email_sent_at) {
    try {
      const merged = { ...order, ...updates };
      await sendOrderEmails({
        order: merged,
        payment: simulatedPayment,
        provider,
        resendApiKey: RESEND_API_KEY,
      });
      await supabase
        .from('orders')
        .update({ email_sent_at: nowIso })
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
    provider,
    order_number: orderNumber,
    payment_status: updates.payment_status,
    email: emailResult,
  });
}
