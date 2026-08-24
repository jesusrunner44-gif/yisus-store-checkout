// Shared admin auth check used by all /api/admin/* endpoints.
// Requires ADMIN_PASSWORD env var to be set; header x-admin-password must match.

export function requireAdmin(req, res) {
  const provided = req.headers['x-admin-password'];
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    res.status(500).json({ error: 'ADMIN_PASSWORD not configured on server.' });
    return false;
  }

  if (typeof provided !== 'string' || provided !== expected) {
    res.status(401).json({ error: 'Unauthorized.' });
    return false;
  }

  return true;
}

export function setAdminCORSHeaders(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-password');
  res.setHeader('Cache-Control', 'no-store');
}
