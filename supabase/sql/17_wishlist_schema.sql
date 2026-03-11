-- ============================================================
-- 17_wishlist_schema.sql
-- Add monthly_income to ledgers and create wishlist_items table
-- ============================================================

-- 1. Add monthly_income to ledgers
alter table public.ledgers
  add column if not exists monthly_income numeric(18,4) not null default 0;

-- 2. Create wishlist_items table
create table if not exists public.wishlist_items (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id) on delete cascade,
  name        text not null,
  cost        numeric(18,4) not null,
  is_selected boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.wishlist_items is 'Tracks items the user wants to buy';

-- 3. RLS Policies for wishlist_items
alter table public.wishlist_items enable row level security;

create policy "Users can view wishlist_items in their ledgers" on public.wishlist_items
  for select using (
    exists (
      select 1 from public.ledger_members
      where ledger_id = public.wishlist_items.ledger_id
      and user_id = auth.uid()
    )
  );

create policy "Editors/Admins/Owners can insert wishlist_items" on public.wishlist_items
  for insert with check (
    exists (
      select 1 from public.ledger_members
      where ledger_id = public.wishlist_items.ledger_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
    )
  );

create policy "Editors/Admins/Owners can update wishlist_items" on public.wishlist_items
  for update using (
    exists (
      select 1 from public.ledger_members
      where ledger_id = public.wishlist_items.ledger_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
    )
  );

create policy "Editors/Admins/Owners can delete wishlist_items" on public.wishlist_items
  for delete using (
    exists (
      select 1 from public.ledger_members
      where ledger_id = public.wishlist_items.ledger_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
    )
  );
