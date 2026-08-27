import { createClient } from '@supabase/supabase-js';
import { signIntegrity, buildCheckoutUrl } from '../lib/wompi.js';

const ALLOWED_ORIGINS = [
  'https://yisusstore.com',
  'https://www.yisusstore.com',
];

const REDIRECT_URL = 'https://yisusstore.com/pago-pendiente-pago-en-proceso';
const CURRENCY = 'COP';

// Shipping rules (source of truth — the client can suggest a value but the
// backend always recomputes and overrides).
const FREE_SHIPPING_THRESHOLD = 150000;
const FLAT_SHIPPING_COST = 13000;

function computeShipping(subtotal) {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING_COST;
}

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

    return { productTitle: productSummary, productSummary, totalQuantity, total };
  }

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

  return {
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

  const {
    WOMPI_PUBLIC_KEY,
    WOMPI_INTEGRITY_SECRET,
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
  } = process.env;

  if (!WOMPI_PUBLIC_KEY || !WOMPI_INTEGRITY_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Server environment variables are not configured.' });
  }

  const body = req.body;

  const { productTitle, productSummary, totalQuantity, total, error: itemsError } = resolveItems(body);
  if (itemsError) return res.status(400).json({ error: itemsError });

  const shippingError = validateShipping(body.shipping);
  if (shippingError) return res.status(400).json({ error: shippingError });

  const { shipping, coupon_code, discount_amount, payment_method, internal_notes } = body;
  const discount = Number(discount_amount ?? 0);
  const subtotalAfterDiscount = Math.max(0, total - discount);
  const shippingCost = computeShipping(subtotalAfterDiscount);
  const grandTotal = subtotalAfterDiscount + shippingCost;
  const amountInCents = Math.round(grandTotal * 100);

  if (amountInCents < 150000) {
    return res.status(400).json({ error: 'Amount below Wompi minimum (1.500 COP).' });
  }

  const orderNumber = generateOrderNumber();
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: order, error: dbError } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      product_title: productTitle,
      quantity: totalQuantity,
      total: grandTotal,
      shipping_cost: shippingCost,
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
      discount_amount: discount,
      payment_method: payment_method || null,
      internal_notes: internal_notes || null,
      payment_provider: 'wompi',
      wompi_reference: orderNumber,
      currency: CURRENCY,
    })
    .select('id')
    .single();

  if (dbError) {
    return res.status(500).json({ error: 'Failed to create order.', details: dbError.message });
  }

  const signature = signIntegrity({
    reference: orderNumber,
    amountInCents,
    currency: CURRENCY,
    integritySecret: WOMPI_INTEGRITY_SECRET,
  });

  const checkoutUrl = buildCheckoutUrl({
    publicKey: WOMPI_PUBLIC_KEY,
    reference: orderNumber,
    amountInCents,
    currency: CURRENCY,
    signature,
    redirectUrl: REDIRECT_URL,
    customerEmail: shipping.email,
    customerName: shipping.fullName,
    customerPhone: shipping.phone,
    shippingAddress: shipping.address,
    shippingCity: shipping.city,
    shippingRegion: shipping.department,
  });

  return res.status(200).json({
    checkout_url: checkoutUrl,
    order_id: order.id,
    order_number: orderNumber,
    amount: grandTotal,
    amount_in_cents: amountInCents,
    products: productSummary,
  });
}
