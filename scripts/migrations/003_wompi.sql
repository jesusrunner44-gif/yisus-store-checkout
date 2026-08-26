-- 003_wompi.sql
-- Adds Wompi payment provider support alongside existing Mercado Pago columns.
-- Backwards compatible: old MP orders keep working, new orders default to 'wompi'.

alter table public.orders
  add column if not exists payment_provider     text default 'wompi',
  add column if not exists wompi_transaction_id text,
  add column if not exists wompi_reference      text;

-- Any pre-existing row without a provider is Mercado Pago.
update public.orders
  set payment_provider = 'mercadopago'
  where payment_provider is null
    and mercado_pago_preference_id is not null;

create index if not exists idx_orders_wompi_transaction
  on public.orders (wompi_transaction_id);

-- Event log for webhook debugging + observability.
create table if not exists public.wompi_events (
  id                 bigserial primary key,
  received_at        timestamptz not null default now(),
  event_type         text,
  transaction_id     text,
  transaction_status text,
  checksum_valid     boolean,
  order_id           uuid references public.orders(id) on delete set null,
  raw_body           jsonb
);

create index if not exists idx_wompi_events_transaction
  on public.wompi_events (transaction_id);
