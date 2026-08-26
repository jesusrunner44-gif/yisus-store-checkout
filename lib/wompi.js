import crypto from 'node:crypto';

const WOMPI_API = 'https://api.wompi.co/v1';
const WOMPI_CHECKOUT = 'https://checkout.wompi.co/p/';

// SHA256(reference + amount_in_cents + currency + integrity_secret)
export function signIntegrity({ reference, amountInCents, currency, integritySecret }) {
  const data = `${reference}${amountInCents}${currency}${integritySecret}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function buildCheckoutUrl({
  publicKey,
  reference,
  amountInCents,
  currency,
  signature,
  redirectUrl,
  customerEmail,
  customerName,
  customerPhone,
  shippingAddress,
  shippingCity,
  shippingRegion,
  shippingCountry = 'CO',
}) {
  const params = new URLSearchParams({
    'public-key': publicKey,
    currency,
    'amount-in-cents': String(amountInCents),
    reference,
    'signature:integrity': signature,
    'redirect-url': redirectUrl,
  });

  if (customerEmail) params.set('customer-data:email', customerEmail);
  if (customerName) params.set('customer-data:full-name', customerName);
  if (customerPhone) params.set('customer-data:phone-number', customerPhone);

  if (shippingAddress) {
    params.set('shipping-address:address-line-1', shippingAddress);
    if (shippingCity) params.set('shipping-address:city', shippingCity);
    if (shippingRegion) params.set('shipping-address:region', shippingRegion);
    if (shippingCountry) params.set('shipping-address:country', shippingCountry);
  }

  return `${WOMPI_CHECKOUT}?${params.toString()}`;
}

// Verifies the checksum Wompi sends on every event.
// checksum = SHA256(concat(values_of_signature.properties) + timestamp + events_secret)
export function verifyWebhookChecksum({ event, eventsSecret }) {
  const props = event?.signature?.properties;
  const checksum = event?.signature?.checksum;
  const timestamp = event?.timestamp;

  if (!Array.isArray(props) || !checksum || timestamp == null) return false;

  const values = props.map((path) => {
    return path.split('.').reduce((obj, key) => (obj == null ? obj : obj[key]), event.data);
  });

  const concatenated = values.map((v) => (v == null ? '' : String(v))).join('') + String(timestamp) + eventsSecret;
  const computed = crypto.createHash('sha256').update(concatenated).digest('hex').toLowerCase();
  const received = String(checksum).toLowerCase();

  if (computed.length !== received.length) return false;
  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(received));
}

// Public transaction endpoint (no auth needed).
export async function fetchTransaction(transactionId) {
  const res = await fetch(`${WOMPI_API}/transactions/${transactionId}`);
  if (!res.ok) return null;
  const json = await res.json();
  return json?.data ?? null;
}

// Maps Wompi status → the internal payment_status vocabulary the app already uses.
// Wompi: PENDING, APPROVED, DECLINED, VOIDED, ERROR
export function normalizeStatus(wompiStatus) {
  const map = {
    APPROVED: 'approved',
    DECLINED: 'rejected',
    VOIDED: 'cancelled',
    ERROR: 'rejected',
    PENDING: 'pending',
  };
  return map[wompiStatus] || 'pending';
}
