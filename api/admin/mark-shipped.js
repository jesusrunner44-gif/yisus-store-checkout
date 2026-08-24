import { createClient } from '@supabase/supabase-js';
import { sendShippedEmail } from '../../lib/email.js';
import { requireAdmin, setAdminCORSHeaders } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  setAdminCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireAdmin(req, res)) return;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  const { order_id, shipping_company, tracking_number, tracking_url, internal_notes } = req.body || {};

  if (!order_id) return res.status(400).json({ error: 'Missing order_id.' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const updates = {
    shipping_status: 'shipped',
    shipped_at: new Date().toISOString(),
  };
  if (shipping_company) updates.shipping_company = shipping_company;
  if (tracking_number) updates.tracking_number = tracking_number;
  if (internal_notes) updates.internal_notes = internal_notes;

  const { data: order, error: dbError } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', order_id)
    .select('id, order_number, customer_name, customer_email, product_title, address, city, department, shipping_company, tracking_number, shipped_email_sent_at')
    .single();

  if (dbError) return res.status(500).json({ error: dbError.message });

  let emailSent = false;
  if (RESEND_API_KEY && !order.shipped_email_sent_at) {
    try {
      await sendShippedEmail({
        order: { ...order, tracking_url: tracking_url || 'https://yisusstore.com' },
        resendApiKey: RESEND_API_KEY,
      });
      await supabase.from('orders').update({ shipped_email_sent_at: new Date().toISOString() }).eq('id', order_id);
      emailSent = true;
    } catch (err) {
      return res.status(200).json({ updated: true, email_error: err.message });
    }
  }

  return res.status(200).json({ updated: true, email_sent: emailSent });
}
