#!/usr/bin/env bash
# Full end-to-end flow test without paying real money.
# Creates an order → simulates an approved Wompi webhook → verifies status + emails.
#
# Usage:
#   SUPABASE_SERVICE_ROLE_KEY=sb_secret_xxx  bash scripts/test-full-flow.sh
#
# Requires: curl, jq (`brew install jq`)

set -euo pipefail

BACKEND="https://yisus-store-checkout.vercel.app"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY env var — copy from Vercel or .env.local}"

# Adjust these to test different scenarios.
TITLE="TEST — Best Protein Chocolate 4LB"
PRICE=2500
QUANTITY=1
EMAIL="${TEST_EMAIL:-mariana@vendoo.co}"

echo "▶ 1/3 Creando orden vía /api/create-transaction..."
CREATE_RES=$(curl -s -X POST "$BACKEND/api/create-transaction" \
  -H "Content-Type: application/json" \
  -H "Origin: https://yisusstore.com" \
  -d "$(cat <<EOF
{
  "title": "$TITLE",
  "price": $PRICE,
  "quantity": $QUANTITY,
  "shipping": {
    "fullName": "TEST — Mariana Osorio",
    "email": "$EMAIL",
    "phone": "3108962777",
    "department": "Caldas",
    "city": "Manizales",
    "address": "Cll TEST 83",
    "neighborhood": "Trebol",
    "extraAddress": "TEST 705",
    "notes": "SIMULADO — no despachar"
  }
}
EOF
)")

ORDER_NUMBER=$(echo "$CREATE_RES" | jq -r '.order_number // empty')
if [ -z "$ORDER_NUMBER" ]; then
  echo "❌ Error creando orden. Respuesta:"
  echo "$CREATE_RES" | jq .
  exit 1
fi
echo "   ✓ Orden creada: $ORDER_NUMBER"

echo ""
echo "▶ 2/3 Simulando webhook 'approved' de Wompi..."
SIM_RES=$(curl -s -X POST "$BACKEND/api/admin/simulate-webhook" \
  -H "Content-Type: application/json" \
  -H "x-service-key: $SUPABASE_SERVICE_ROLE_KEY" \
  -d "{\"order_number\": \"$ORDER_NUMBER\"}")

echo "$SIM_RES" | jq .
EMAIL_STATUS=$(echo "$SIM_RES" | jq -r '.email // "unknown"')

echo ""
echo "▶ 3/3 Verificando estado final vía /api/order-status..."
STATUS_RES=$(curl -s "$BACKEND/api/order-status?order_number=$ORDER_NUMBER")
echo "$STATUS_RES" | jq .

echo ""
echo "═══════════════════════════════════════════════"
echo "  Resumen del test"
echo "═══════════════════════════════════════════════"
echo "  Orden:          $ORDER_NUMBER"
echo "  Email enviado:  $EMAIL_STATUS"
echo "  Ver en admin:   $BACKEND/admin.html"
echo "  Panel Supabase: https://supabase.com/dashboard/project/nbrcotnnuhdroetjxzip/editor"
echo ""
echo "▶ Para limpiar la orden de test:"
echo "  delete from public.orders where order_number = '$ORDER_NUMBER';"
