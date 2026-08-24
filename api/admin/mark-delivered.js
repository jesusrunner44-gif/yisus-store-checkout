import { createClient } from '@supabase/supabase-js';
import { sendDeliveredEmail } from '../../lib/email.js';
import { requireAdmin, setAdminCORSHeaders } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  setAdminCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireAdmin(req, res)) return;

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  const { order_id } = req.body || {};

  if (!order_id) return res.status(400).json({ error: 'Missing order_id.' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: order, error: dbError } = await supabase
    .from('orders')
    .update({ shipping_status: 'delivered', delivered_at: new Date().toISOString() })
    .eq('id', order_id)
    .select('id, order_number, customer_name, customer_email, product_title, delivered_email_sent_at')
    .single();

  if (dbError) return res.status(500).json({ error: dbError.message });

  let emailSent = false;
  if (RESEND_API_KEY && !order.delivered_email_sent_at) {
    try {
      await sendDeliveredEmail({ order, resendApiKey: RESEND_API_KEY });
      await supabase.from('orders').update({ delivered_email_sent_at: new Date().toISOString() }).eq('id', order_id);
      emailSent = true;
    } catch (err) {
      return res.status(200).json({ updated: true, email_error: err.message });
    }
  }

  return res.status(200).json({ updated: true, email_sent: emailSent });
}
