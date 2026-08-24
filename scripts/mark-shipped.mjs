// Marks an order as 'shipped' and triggers the shipping email.
// Usage:
//   node scripts/mark-shipped.mjs YS-1787606247050 "Coordinadora" "COO-ABC123"
//
// Args:
//   1) order_number      (required) — e.g. YS-1787606247050
//   2) shipping_company  (optional) — e.g. "Coordinadora" / "Servientrega" / "Interrapidísimo"
//   3) tracking_number   (optional) — the tracking code
//
// Runs against production (yisus-store-checkout.vercel.app).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const envPath = join(here, "..", ".env.local");
for (const line of readFileSync(envPath, "utf8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2];
}

const [, , orderNumber, shippingCompany, trackingNumber] = process.argv;

if (!orderNumber) {
  console.error("Usage: node scripts/mark-shipped.mjs YS-XXXXXXXXXX [company] [tracking]");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: order, error } = await supabase
  .from("orders")
  .select("id, order_number, customer_email, payment_status")
  .eq("order_number", orderNumber)
  .maybeSingle();

if (error) { console.error("Lookup failed:", error.message); process.exit(1); }
if (!order) { console.error(`Order ${orderNumber} not found.`); process.exit(1); }

console.log(`→ Order ${order.order_number}  (${order.customer_email})`);
console.log(`  payment_status: ${order.payment_status}`);

const body = { order_id: order.id, shipping_status: "shipped" };
if (shippingCompany) body.shipping_company = shippingCompany;
if (trackingNumber) body.tracking_number = trackingNumber;

const res = await fetch("https://yisus-store-checkout.vercel.app/api/update-order", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://yisusstore.com" },
  body: JSON.stringify(body),
});

console.log(`\nHTTP ${res.status}`);
console.log(await res.text());
