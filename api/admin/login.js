import { requireAdmin, setAdminCORSHeaders } from '../../lib/admin-auth.js';

export default async function handler(req, res) {
  setAdminCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!requireAdmin(req, res)) return;
  return res.status(200).json({ ok: true });
}
