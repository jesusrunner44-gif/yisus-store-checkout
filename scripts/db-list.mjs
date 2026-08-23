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

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const { data, error } = await supabase
  .from("orders")
  .select("id, order_number, created_at, customer_name, customer_email, product_title, total, payment_status, shipping_status")
  .order("created_at", { ascending: false });

if (error) {
  console.error(error.message);
  process.exit(1);
}

for (const r of data) {
  console.log(`\n#${r.order_number}   ${r.created_at}`);
  console.log(`  ${r.customer_name}  <${r.customer_email}>`);
  console.log(`  ${r.product_title}  ·  $${r.total}`);
  console.log(`  payment=${r.payment_status}  shipping=${r.shipping_status}`);
  console.log(`  id=${r.id}`);
}
