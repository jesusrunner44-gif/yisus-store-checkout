import DIVIPOLA from '../data/divipola.json' with { type: 'json' };

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
  // Cache 24h in browser + CDN. Dataset is static (DANE DIVIPOLA).
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
}

export default function handler(req, res) {
  setCORSHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  return res.status(200).json(DIVIPOLA);
}
