import { createClient } from '@supabase/supabase-js';
import { sendOrderEmails } from '../lib/email.js';
import { verifyWebhookChecksum, normalizeStatus, fetchTransaction } from '../lib/wompi.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    WOMPI_EVENTS_SECRET,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    RESEND_API_KEY,
  } = process.env;

  if (!WOMPI_EVENTS_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).end();
  }

  const event = req.body;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const checksumValid = verifyWebhookChecksum({ event, eventsSecret: WOMPI_EVENTS_SECRET });
  const txn = event?.data?.transaction;

  await supabase.from('wompi_events').insert({
    event_type: event?.event ?? null,
    transaction_id: txn?.id ? String(txn.id) : null,
    transaction_status: txn?.status ?? null,
    checksum_valid: checksumValid,
    raw_body: event ?? null,
  }).then(() => {}, () => {});

  if (!checksumValid) return res.status(401).json({ error: 'Invalid checksum.' });
  if (!txn?.reference) return res.status(200).end();

  // Fetch the fresh transaction from Wompi (webhook payload is a snapshot; API is source of truth).
  const fresh = await fetchTransaction(txn.id);
  const transaction = fresh || txn;

  const reference = transaction.reference;
  const { data: order } = await supabase
    .from('orders')
    .select('id, order_number, product_title, total, paid_amount, customer_name, customer_email, customer_phone, address, neighborhood, city, department, extra_address, notes, email_sent_at, wompi_transaction_id, payment_status')
    .eq('order_number', reference)
    .maybeSingle();

  if (!order) return res.status(200).json({ received: true, warning: 'order_not_found' });

  const newStatus = normalizeStatus(transaction.status);

  // Idempotency: same transaction id already recorded with same status → skip DB update + emails.
  const alreadyProcessed =
    order.wompi_transaction_id === String(transaction.id) &&
    order.payment_status === newStatus;

  if (!alreadyProcessed) {
    const updates = {
      payment_status: newStatus,
      payment_provider: 'wompi',
      wompi_transaction_id: String(transaction.id),
      wompi_reference: reference,
    };
    if (transaction.payment_method_type) updates.payment_method = transaction.payment_method_type;
    if (transaction.amount_in_cents != null) updates.paid_amount = transaction.amount_in_cents / 100;
    if (transaction.currency) updates.currency = transaction.currency;
    if (transaction.customer_email) updates.payer_email = transaction.customer_email;
    if (newStatus === 'approved' && transaction.finalized_at) updates.approved_at = transaction.finalized_at;

    await supabase.from('orders').update(updates).eq('id', order.id);

    await supabase
      .from('wompi_events')
      .update({ order_id: order.id })
      .eq('transaction_id', String(transaction.id))
      .is('order_id', null);
  }

  if (newStatus === 'approved' && RESEND_API_KEY && !order.email_sent_at) {
    const paymentShim = {
      id: String(transaction.id),
      status: newStatus,
      payment_type_id: transaction.payment_method_type,
      payment_method_id: transaction.payment_method_type,
    };

    try {
      await sendOrderEmails({
        order: { ...order, paid_amount: transaction.amount_in_cents != null ? transaction.amount_in_cents / 100 : order.paid_amount },
        payment: paymentShim,
        provider: 'wompi',
        resendApiKey: RESEND_API_KEY,
      });

      await supabase
        .from('orders')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', order.id);
    } catch (err) {
      return res.status(200).json({ received: true, email_error: err.message });
    }
  }

  return res.status(200).json({ received: true });
}
