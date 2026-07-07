import { createClient } from '@supabase/supabase-js';

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

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
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

  const { error: dbError } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', order_id);

  if (dbError) {
    return res.status(500).json({ error: 'Failed to update order.', details: dbError.message });
  }

  return res.status(200).json({ updated: true, order_id });
}
