const ALLOWED_ORIGINS = [
  'https://yisusstore.com',
  'https://www.yisusstore.com',
];

const MP_API_URL = 'https://api.mercadopago.com/checkout/preferences';

function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isValidNumber(value) {
  return typeof value === 'number' && isFinite(value) && value > 0;
}

function buildItems(body) {
  if (Array.isArray(body.items)) {
    for (const item of body.items) {
      if (!item.title || !isValidNumber(item.unit_price) || !isValidNumber(item.quantity)) {
        return { error: 'Each item must have a valid title, unit_price, and quantity.' };
      }
    }
    return {
      items: body.items.map((item) => ({
        title: String(item.title),
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        currency_id: 'COP',
      })),
    };
  }

  if (body.title !== undefined) {
    if (!body.title || !isValidNumber(body.price) || !isValidNumber(body.quantity)) {
      return { error: 'Single product requires a valid title, price, and quantity.' };
    }
    return {
      items: [
        {
          title: String(body.title),
          quantity: Number(body.quantity),
          unit_price: Number(body.price),
          currency_id: 'COP',
        },
      ],
    };
  }

  return { error: 'Request body must include either "items" array or a single product with "title", "price", and "quantity".' };
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const accessToken = process.env.MP_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: 'MP_ACCESS_TOKEN is not configured.' });
  }

  const { items, error } = buildItems(req.body);
  if (error) {
    return res.status(400).json({ error });
  }

  const preference = {
    items,
    back_urls: {
      success: 'https://yisusstore.com/gracias',
      failure: 'https://yisusstore.com/pago-fallido',
      pending: 'https://yisusstore.com/pago-pendiente',
    },
    auto_return: 'approved',
  };

  const mpResponse = await fetch(MP_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(preference),
  });

  if (!mpResponse.ok) {
    const mpError = await mpResponse.json().catch(() => ({}));
    return res.status(mpResponse.status).json({
      error: 'Mercado Pago returned an error.',
      details: mpError,
    });
  }

  const data = await mpResponse.json();

  return res.status(200).json({
    init_point: data.init_point,
    sandbox_init_point: data.sandbox_init_point,
  });
}
