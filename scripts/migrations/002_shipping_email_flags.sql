-- 002_shipping_email_flags.sql
-- Adds dedicated flags to prevent duplicate shipping/delivered emails.
-- Idempotent.

alter table public.orders
  add column if not exists shipped_email_sent_at   timestamptz,
  add column if not exists delivered_email_sent_at timestamptz;
