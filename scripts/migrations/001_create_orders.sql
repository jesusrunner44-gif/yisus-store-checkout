-- 001_create_orders.sql
-- Creates the orders table used by the Yisus Store checkout backend.
-- Idempotent: safe to re-run.

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id                          uuid primary key default gen_random_uuid(),
  created_at                  timestamptz not null default now(),

  -- Order identity & items
  order_number                text not null unique,
  product_title               text not null,
  quantity                    integer not null,
  total                       numeric not null,
  shipping_cost               numeric not null default 0,

  -- Customer / shipping address
  customer_name               text not null,
  customer_email              text not null,
  customer_phone              text not null,
  department                  text not null,
  city                        text not null,
  address                     text not null,
  neighborhood                text not null,
  extra_address               text,
  notes                       text,

  -- Order state
  payment_status              text not null default 'pending',
  shipping_status             text not null default 'pending',

  -- Discounts
  coupon_code                 text,
  discount_amount             numeric not null default 0,

  -- Mercado Pago
  mercado_pago_preference_id  text,
  mercado_pago_payment_id     text,
  payment_method              text,
  paid_amount                 numeric,
  currency                    text,
  installments                integer,
  payer_email                 text,
  approved_at                 timestamptz,

  -- Shipping fulfillment
  shipping_company            text,
  tracking_number             text,
  shipped_at                  timestamptz,
  delivered_at                timestamptz,

  -- Internal ops
  internal_notes              text,
  email_sent_at               timestamptz
);

create index if not exists orders_order_number_idx        on public.orders (order_number);
create index if not exists orders_payment_status_idx      on public.orders (payment_status);
create index if not exists orders_shipping_status_idx     on public.orders (shipping_status);
create index if not exists orders_created_at_idx          on public.orders (created_at desc);
create index if not exists orders_customer_email_idx      on public.orders (customer_email);
create index if not exists orders_mp_payment_id_idx       on public.orders (mercado_pago_payment_id);

alter table public.orders enable row level security;
-- Service role bypasses RLS by design; no anon/authenticated policies added,
-- so the table is only reachable through the checkout backend (service key).
