import { createClient } from '@supabase/supabase-js';

const ALLOWED_ORIGINS = [
  'https://yisusstore.com',
  'https://www.yisusstore.com',
];

const MP_API_URL = 'https://api.mercadopago.com/checkout/preferences';
const WEBHOOK_URL = 'https://yisus-store-checkout.vercel.app/api/mercadopago-webhook';

const REQUIRED_SHIPPING = [
  'fullName', 'email', 'phone', 'department', 'city', 'address', 'neighborhood',
];

function setCORSHeaders(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function generateOrderNumber() {
  return `YS-${Date.now()}`;
}

// Returns { mpItems, productTitle, productSummary, totalQuantity, total, error }
// mpItems  → sent to Mercado Pago
// productTitle → saved in Supabase product_title
// productSummary → added to MP metadata.products
function resolveItems(body) {
  if (Array.isArray(body.items) && body.items.length > 0) {
    for (const item of body.items) {
      if (!item.title || typeof item.title !== 'string') {
        return { error: 'Each item must have a valid title.' };
      }
      if (typeof item.unit_price !== 'number' || item.unit_price <= 0) {
        return { error: `Item "${item.title}" must have a valid unit_price.` };
      }
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        return { error: `Item "${item.title}" must have a valid quantity.` };
      }
    }

    const totalQuantity = body.items.reduce((sum, i) => sum + Number(i.quantity), 0);
    const total = body.items.reduce((sum, i) => sum + Number(i.unit_price) * Number(i.quantity), 0);
    const productSummary = body.items.map((i) => `${i.title} x${i.quantity}`).join(' + ');

    const mpItems = [
      {
        title: `Carrito Yisus Store - ${totalQuantity} productos`,
        quantity: 1,
        unit_price: total,
        currency_id: 'COP',
      },
    ];

    return { mpItems, productTitle: productSummary, productSummary, totalQuantity, total };
  }

  // Single product
  const { title, price, quantity } = body;
  if (!title || typeof title !== 'string') {
    return { error: 'Missing required field: title' };
  }
  if (typeof price !== 'number' || price <= 0) {
    return { error: 'price must be a positive number.' };
  }
  if (typeof quantity !== 'number' || quantity <= 0) {
    return { error: 'quantity must be a positive number.' };
  }

  const mpItems = [{ title: String(title), quantity: Number(quantity), unit_price: Number(price), currency_id: 'COP' }];
  return {
    mpItems,
    productTitle: String(title),
    productSummary: `${title} x${quantity}`,
    totalQuantity: Number(quantity),
    total: price * quantity,
  };
}

function validateShipping(s) {
  if (!s || typeof s !== 'object') return 'Missing required field: shipping';
  for (const field of REQUIRED_SHIPPING) {
    if (!s[field]) return `Missing required shipping field: ${field}`;
  }
  return null;
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

  const { mpItems, productTitle, productSummary, totalQuantity, total, error: itemsError } = resolveItems(body);
  if (itemsError) return res.status(400).json({ error: itemsError });

  const shippingError = validateShipping(body.shipping);
  if (shippingError) return res.status(400).json({ error: shippingError });

  const { shipping, coupon_code, discount_amount, payment_method, internal_notes, shipping_cost } = body;
  const orderNumber = generateOrderNumber();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: order, error: dbError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      product_title: productTitle,
      quantity: totalQuantity,
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
    items: mpItems,
    payer: { email: shipping.email },
    metadata: {
      order_id: orderId,
      order_number: orderNumber,
      customer_email: shipping.email,
      customer_phone: shipping.phone,
      products: productSummary,
    },
    back_urls: {
      success: 'https://yisusstore.com/gracias',
      failure: 'https://yisusstore.com/pago-fallido',
      pending: 'https://yisusstore.com/pago-pendiente',
    },
    auto_return: 'approved',
    notification_url: WEBHOOK_URL,
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
    order_number: orderNumber,
  });
}
