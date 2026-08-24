import { createClient } from '@supabase/supabase-js';
import { requireAdmin, setAdminCORSHeaders } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  setAdminCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireAdmin(req, res)) return;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const search = (req.query.search || '').trim();

  let query = supabase
    .from('orders')
    .select('id, order_number, created_at, customer_name, customer_email, customer_phone, product_title, quantity, total, paid_amount, payment_status, shipping_status, shipping_company, tracking_number, address, neighborhood, city, department, extra_address, notes, internal_notes, shipped_at, delivered_at, email_sent_at, shipped_email_sent_at, delivered_email_sent_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (search) {
    query = query.or(`order_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_email.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  return res.status(200).json({ orders: data });
}
