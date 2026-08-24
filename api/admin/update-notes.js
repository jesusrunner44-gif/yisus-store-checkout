import { createClient } from '@supabase/supabase-js';
import { requireAdmin, setAdminCORSHeaders } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  setAdminCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireAdmin(req, res)) return;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  const { order_id, internal_notes } = req.body || {};

  if (!order_id) return res.status(400).json({ error: 'Missing order_id.' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { error: dbError } = await supabase
    .from('orders')
    .update({ internal_notes: internal_notes ?? null })
    .eq('id', order_id);

  if (dbError) return res.status(500).json({ error: dbError.message });

  return res.status(200).json({ updated: true });
}
