import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  'https://yisusstore.com',
  'https://www.yisusstore.com',
];

function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server environment variables are not configured.' });
  }

  const orderNumber = req.query.order_number;
  if (!orderNumber || typeof orderNumber !== 'string') {
    return res.status(400).json({ error: 'Missing required query param: order_number' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data, error } = await supabase
    .from('orders')
    .select('order_number, payment_status, shipping_status')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error) {
    return res.status(500).json({ error: 'Lookup failed.', details: error.message });
  }

  if (!data) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  return res.status(200).json({
    order_number: data.order_number,
    payment_status: data.payment_status,
    shipping_status: data.shipping_status,
  });
}
