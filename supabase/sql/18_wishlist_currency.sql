-- ============================================================
-- 18_wishlist_currency.sql
-- Add currency support to ledgers.monthly_income and wishlist_items
-- ============================================================

-- 1. Add monthly_income_currency to ledgers
alter table public.ledgers
  add column if not exists monthly_income_currency text not null default 'USD';

-- 2. Add currency_code to wishlist_items
alter table public.wishlist_items
  add column if not exists currency_code text not null default 'USD';
