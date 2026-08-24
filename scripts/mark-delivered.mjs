// Marks an order as 'delivered' and triggers the delivered email.
// Usage: node scripts/mark-delivered.mjs YS-1787606247050

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

const [, , orderNumber] = process.argv;

if (!orderNumber) {
  console.error("Usage: node scripts/mark-delivered.mjs YS-XXXXXXXXXX");
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data: order, error } = await supabase
  .from("orders")
  .select("id, order_number, customer_email, payment_status, shipping_status")
  .eq("order_number", orderNumber)
  .maybeSingle();

if (error) { console.error("Lookup failed:", error.message); process.exit(1); }
if (!order) { console.error(`Order ${orderNumber} not found.`); process.exit(1); }

console.log(`→ Order ${order.order_number}  (${order.customer_email})`);
console.log(`  payment=${order.payment_status}  shipping=${order.shipping_status}`);

const res = await fetch("https://yisus-store-checkout.vercel.app/api/update-order", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: "https://yisusstore.com" },
  body: JSON.stringify({ order_id: order.id, shipping_status: "delivered" }),
});

console.log(`\nHTTP ${res.status}`);
console.log(await res.text());
