import { createClient } from '@supabase/supabase-js';
import { sendShippedEmail, sendDeliveredEmail } from '../lib/email.js';

const ALLOWED_ORIGINS = [
  'https://yisusstore.com',
  'https://www.yisusstore.com',
];

const VALID_SHIPPING_STATUSES = ['pending', 'preparing', 'shipped', 'delivered', 'cancelled'];

function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server environment variables are not configured.' });
  }

  const { order_id, shipping_company, tracking_number, shipping_status, internal_notes } = req.body || {};

  if (!order_id) {
    return res.status(400).json({ error: 'Missing required field: order_id' });
  }

  if (shipping_status && !VALID_SHIPPING_STATUSES.includes(shipping_status)) {
    return res.status(400).json({
      error: `Invalid shipping_status. Allowed values: ${VALID_SHIPPING_STATUSES.join(', ')}`,
    });
  }

  const updates = {};

  if (shipping_company !== undefined) updates.shipping_company = shipping_company;
  if (tracking_number !== undefined) updates.tracking_number = tracking_number;
  if (internal_notes !== undefined) updates.internal_notes = internal_notes;

  if (shipping_status) {
    updates.shipping_status = shipping_status;
    if (shipping_status === 'shipped') updates.shipped_at = new Date().toISOString();
    if (shipping_status === 'delivered') updates.delivered_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update.' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: updated, error: dbError } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', order_id)
    .select('id, order_number, customer_name, customer_email, product_title, address, city, department, shipping_company, tracking_number, shipping_status, shipped_email_sent_at, delivered_email_sent_at')
    .single();

  if (dbError) {
    return res.status(500).json({ error: 'Failed to update order.', details: dbError.message });
  }

  let emailSent = null;

  if (shipping_status === 'shipped' && RESEND_API_KEY && !updated.shipped_email_sent_at) {
    try {
      await sendShippedEmail({ order: updated, resendApiKey: RESEND_API_KEY });
      await supabase
        .from('orders')
        .update({ shipped_email_sent_at: new Date().toISOString() })
        .eq('id', order_id);
      emailSent = 'shipped';
    } catch (err) {
      return res.status(200).json({ updated: true, order_id, email_error: err.message });
    }
  }

  if (shipping_status === 'delivered' && RESEND_API_KEY && !updated.delivered_email_sent_at) {
    try {
      await sendDeliveredEmail({ order: updated, resendApiKey: RESEND_API_KEY });
      await supabase
        .from('orders')
        .update({ delivered_email_sent_at: new Date().toISOString() })
        .eq('id', order_id);
      emailSent = 'delivered';
    } catch (err) {
      return res.status(200).json({ updated: true, order_id, email_error: err.message });
    }
  }

  return res.status(200).json({ updated: true, order_id, email_sent: emailSent });
}
