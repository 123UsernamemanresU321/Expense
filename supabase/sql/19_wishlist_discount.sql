-- ============================================================
-- 19_wishlist_discount.sql
-- Add discount to wishlist_items table
-- ============================================================

alter table public.wishlist_items
  add column if not exists discount numeric(18,4) not null default 0;
