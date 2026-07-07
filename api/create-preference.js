import { createClient } from '@supabase/supabase-js';

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

const REQUIRED_FIELDS = ['title', 'price', 'quantity'];
const REQUIRED_SHIPPING = [
  'fullName', 'email', 'phone', 'department', 'city', 'address', 'neighborhood',
];

function validate(body) {
  for (const field of REQUIRED_FIELDS) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Missing required field: ${field}`;
    }
  }
  if (typeof body.price !== 'number' || body.price <= 0) {
    return 'price must be a positive number.';
  }
  if (typeof body.quantity !== 'number' || body.quantity <= 0) {
    return 'quantity must be a positive number.';
  }
  const s = body.shipping;
  if (!s || typeof s !== 'object') return 'Missing required field: shipping';
  for (const field of REQUIRED_SHIPPING) {
    if (!s[field]) return `Missing required shipping field: ${field}`;
  }
  return null;
}

function generateOrderNumber() {
  return `YS-${Date.now()}`;
}

export default async function handler(req, res) {
  setCORSHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  const { MP_ACCESS_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!MP_ACCESS_TOKEN || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server environment variables are not configured.' });
  }

  const body = req.body;
  const validationError = validate(body);
  if (validationError) return res.status(400).json({ error: validationError });

  const {
    title, price, quantity, shipping,
    coupon_code, discount_amount, payment_method, internal_notes,
    shipping_cost,
  } = body;

  const total = price * quantity;

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: order, error: dbError } = await supabase
    .from('orders')
    .insert({
      order_number: generateOrderNumber(),
      product_title: title,
      quantity,
      total,
      shipping_cost: shipping_cost ?? 0,
      customer_name: shipping.fullName,
      customer_email: shipping.email,
      customer_phone: shipping.phone,
      department: shipping.department,
      city: shipping.city,
      address: shipping.address,
      neighborhood: shipping.neighborhood,
      extra_address: shipping.extraAddress || null,
      notes: shipping.notes || null,
      payment_status: 'pending',
      shipping_status: 'pending',
      coupon_code: coupon_code || null,
      discount_amount: discount_amount ?? 0,
      payment_method: payment_method || null,
      internal_notes: internal_notes || null,
    })
    .select('id')
    .single();

  if (dbError) {
    return res.status(500).json({ error: 'Failed to create order.', details: dbError.message });
  }

  const orderId = order.id;

  const preference = {
    items: [
      {
        title: String(title),
        quantity: Number(quantity),
        unit_price: Number(price),
        currency_id: 'COP',
      },
    ],
    payer: { email: shipping.email },
    metadata: {
      order_id: orderId,
      customer_name: shipping.fullName,
      customer_email: shipping.email,
      customer_phone: shipping.phone,
      city: shipping.city,
      address: shipping.address,
    },
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
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
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

  const mpData = await mpResponse.json();

  await supabase
    .from('orders')
    .update({ mercado_pago_preference_id: mpData.id })
    .eq('id', orderId);

  return res.status(200).json({
    init_point: mpData.init_point,
    sandbox_init_point: mpData.sandbox_init_point,
    order_id: orderId,
  });
}
