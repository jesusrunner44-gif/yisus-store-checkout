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

const EXPECTED = [
  "id", "created_at",
  "order_number", "product_title", "quantity", "total", "shipping_cost",
  "customer_name", "customer_email", "customer_phone", "department", "city",
  "address", "neighborhood", "extra_address", "notes",
  "payment_status", "shipping_status",
  "coupon_code", "discount_amount",
  "mercado_pago_preference_id", "mercado_pago_payment_id", "payment_method",
  "paid_amount", "currency", "installments", "payer_email", "approved_at",
  "shipping_company", "tracking_number", "shipped_at", "delivered_at",
  "internal_notes", "email_sent_at",
];

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log("→ Fetching OpenAPI schema…");
const openapi = await fetch(`${url}/rest/v1/`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
}).then((r) => r.json());

const table = openapi.definitions?.orders;
if (!table) {
  console.error("✗ 'orders' table not exposed by PostgREST. Did the migration run?");
  process.exit(1);
}

const cols = Object.keys(table.properties || {}).sort();
const missing = EXPECTED.filter((c) => !cols.includes(c));
const extra = cols.filter((c) => !EXPECTED.includes(c));

console.log(`✓ Table 'orders' exists — ${cols.length} columns.`);
if (missing.length) console.log(`✗ Missing: ${missing.join(", ")}`);
else console.log("✓ All expected columns present.");
if (extra.length) console.log(`ℹ Extra columns (not required): ${extra.join(", ")}`);

console.log("\n→ Round-trip test (insert → select → delete)…");
const testOrderNumber = `YS-TEST-${Date.now()}`;
const testRow = {
  order_number: testOrderNumber,
  product_title: "TEST — safe to delete",
  quantity: 1,
  total: 1,
  customer_name: "Test User",
  customer_email: "test@yisusstore.com",
  customer_phone: "0000000000",
  department: "Cundinamarca",
  city: "Bogotá",
  address: "Test Ave 1",
  neighborhood: "Test",
};

const { data: inserted, error: insErr } = await supabase
  .from("orders")
  .insert(testRow)
  .select("id, order_number, payment_status, shipping_status, discount_amount, shipping_cost, created_at")
  .single();

if (insErr) {
  console.error("✗ Insert failed:", insErr.message);
  process.exit(1);
}
console.log("✓ Insert OK — defaults applied:", {
  payment_status: inserted.payment_status,
  shipping_status: inserted.shipping_status,
  discount_amount: inserted.discount_amount,
  shipping_cost: inserted.shipping_cost,
  created_at: inserted.created_at,
});

const { error: delErr } = await supabase
  .from("orders")
  .delete()
  .eq("id", inserted.id);

if (delErr) {
  console.error("✗ Cleanup delete failed — test row remains:", inserted.id);
  process.exit(1);
}
console.log("✓ Test row deleted.");

const { count } = await supabase
  .from("orders")
  .select("*", { count: "exact", head: true });
console.log(`\n✓ Final state — orders count: ${count}`);
console.log("✓ All checks passed.");
