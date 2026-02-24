-- ============================================================
-- 01_enums_tables.sql
-- Personal Finance Dashboard — Schema Contract
-- Run FIRST in Supabase Dashboard SQL Editor
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================

create type public.ledger_role as enum (
  'owner',
  'admin',
  'editor',
  'viewer'
);

create type public.txn_type as enum (
  'income',
  'expense',
  'transfer',
  'refund',
  'adjustment'
);

create type public.account_type as enum (
  'checking',
  'savings',
  'credit_card',
  'cash',
  'investment',
  'loan',
  'other'
);

create type public.budget_period as enum (
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
);

create type public.subscription_interval as enum (
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly'
);

create type public.notification_type as enum (
  'budget_warning',
  'budget_exceeded',
  'subscription_due',
  'month_closed',
  'member_added',
  'insight',
  'system'
);

create type public.export_format as enum (
  'csv',
  'xlsx',
  'pdf',
  'json'
);

create type public.ocr_status as enum (
  'pending',
  'processing',
  'completed',
  'failed'
);

-- ============================================================
-- TABLES
-- ============================================================

-- 1. profiles
-- Mirrors auth.users; created via trigger on signup
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  display_name  text,
  avatar_url    text,
  currency_code text not null default 'USD',
  locale        text not null default 'en-US',
  timezone      text not null default 'UTC',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.profiles is 'User profile — synced from auth.users on signup';

-- 2. ledgers
-- A ledger groups all financial data; users share access via ledger_members
create table public.ledgers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  currency_code text not null default 'USD',
  created_by  uuid not null references auth.users(id) on delete restrict,
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.ledgers is 'Top-level data container; all financial entities belong to a ledger';

-- 3. ledger_members
-- Junction: user ↔ ledger with role
create table public.ledger_members (
  id         uuid primary key default gen_random_uuid(),
  ledger_id  uuid not null references public.ledgers(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       public.ledger_role not null default 'viewer',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at  timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ledger_id, user_id)
);
comment on table public.ledger_members is 'Maps users to ledgers with role-based access';

-- 4. accounts
create table public.accounts (
  id            uuid primary key default gen_random_uuid(),
  ledger_id     uuid not null references public.ledgers(id) on delete cascade,
  name          text not null,
  account_type  public.account_type not null default 'checking',
  currency_code text not null default 'USD',
  balance       numeric(18,4) not null default 0,
  is_active     boolean not null default true,
  institution   text,
  note          text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.accounts is 'Bank/cash/credit accounts within a ledger';

-- 5. categories (tree via parent_id)
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  ledger_id  uuid not null references public.ledgers(id) on delete cascade,
  parent_id  uuid references public.categories(id) on delete cascade,
  name       text not null,
  icon       text,
  color      text,
  is_income  boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.categories is 'Hierarchical category tree (parent_id self-ref)';

-- 6. tags
create table public.tags (
  id         uuid primary key default gen_random_uuid(),
  ledger_id  uuid not null references public.ledgers(id) on delete cascade,
  name       text not null,
  color      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ledger_id, name)
);
comment on table public.tags is 'Free-form labels attachable to transactions';

-- 7. merchants
create table public.merchants (
  id           uuid primary key default gen_random_uuid(),
  ledger_id    uuid not null references public.ledgers(id) on delete cascade,
  name         text not null,
  category_id  uuid references public.categories(id) on delete set null,
  logo_url     text,
  website      text,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
comment on table public.merchants is 'Merchant/payee directory for auto-categorization';

-- 8. transactions
create table public.transactions (
  id                uuid primary key default gen_random_uuid(),
  ledger_id         uuid not null references public.ledgers(id) on delete cascade,
  account_id        uuid not null references public.accounts(id) on delete restrict,
  category_id       uuid references public.categories(id) on delete set null,
  merchant_id       uuid references public.merchants(id) on delete set null,
  txn_type          public.txn_type not null,
  amount            numeric(18,4) not null,
  currency_code     text not null default 'USD',
  date              date not null default current_date,
  description       text,
  notes             text,
  is_split          boolean not null default false,
  -- Transfer fields
  transfer_peer_id  uuid references public.transactions(id) on delete set null,
  -- Refund linkage
  refund_of_id      uuid references public.transactions(id) on delete set null,
  -- Reconciliation
  is_reconciled     boolean not null default false,
  reconciled_at     timestamptz,
  -- Metadata
  external_id       text,
  created_by        uuid not null references auth.users(id) on delete restrict,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- Guard: refund must reference a real transaction
  constraint chk_refund check (
    (txn_type = 'refund' and refund_of_id is not null)
    or txn_type != 'refund'
  ),
  -- Guard: transfer must have a peer (populated after both sides exist)
  -- Note: peer linkage is set after inserting both sides; skip strict check here
  constraint chk_amount_positive check (amount >= 0)
);
comment on table public.transactions is 'Core transaction ledger — income/expense/transfer/refund/adjustment';

-- 9. transaction_splits
create table public.transaction_splits (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references public.transactions(id) on delete cascade,
  category_id     uuid references public.categories(id) on delete set null,
  amount          numeric(18,4) not null,
  description     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint chk_split_amount_positive check (amount >= 0)
);
comment on table public.transaction_splits is 'Split lines for a parent transaction (sum must equal parent amount)';

-- 10. transaction_tags
create table public.transaction_tags (
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id         uuid not null references public.tags(id) on delete cascade,
  created_at     timestamptz not null default now(),
  primary key (transaction_id, tag_id)
);
comment on table public.transaction_tags is 'Many-to-many: transactions ↔ tags';

-- 11. budgets
create table public.budgets (
  id            uuid primary key default gen_random_uuid(),
  ledger_id     uuid not null references public.ledgers(id) on delete cascade,
  category_id   uuid references public.categories(id) on delete set null,
  name          text not null,
  amount        numeric(18,4) not null,
  period        public.budget_period not null default 'monthly',
  start_date    date not null,
  end_date      date,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint chk_budget_amount check (amount > 0)
);
comment on table public.budgets is 'Budget targets per category/period';

-- 12. budget_alerts
create table public.budget_alerts (
  id             uuid primary key default gen_random_uuid(),
  budget_id      uuid not null references public.budgets(id) on delete cascade,
  threshold_pct  numeric(5,2) not null default 80.00,
  triggered_at   timestamptz,
  notified       boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint chk_threshold check (threshold_pct > 0 and threshold_pct <= 100)
);
comment on table public.budget_alerts is 'Threshold-based alerts for budget tracking';

-- 13. subscriptions
create table public.subscriptions (
  id              uuid primary key default gen_random_uuid(),
  ledger_id       uuid not null references public.ledgers(id) on delete cascade,
  account_id      uuid references public.accounts(id) on delete set null,
  category_id     uuid references public.categories(id) on delete set null,
  merchant_id     uuid references public.merchants(id) on delete set null,
  name            text not null,
  amount          numeric(18,4) not null,
  currency_code   text not null default 'USD',
  interval        public.subscription_interval not null default 'monthly',
  next_due_date   date not null,
  is_active       boolean not null default true,
  auto_create_txn boolean not null default false,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.subscriptions is 'Recurring subscription tracker';

-- 14. exchange_rates
create table public.exchange_rates (
  id             uuid primary key default gen_random_uuid(),
  base_currency  text not null,
  quote_currency text not null,
  rate           numeric(18,8) not null,
  rate_date      date not null default current_date,
  source         text default 'manual',
  created_at     timestamptz not null default now(),
  unique (base_currency, quote_currency, rate_date)
);
comment on table public.exchange_rates is 'Daily exchange rates for multi-currency support';

-- 15. classification_rules
create table public.classification_rules (
  id            uuid primary key default gen_random_uuid(),
  ledger_id     uuid not null references public.ledgers(id) on delete cascade,
  match_field   text not null default 'description',
  match_pattern text not null,
  category_id   uuid references public.categories(id) on delete set null,
  merchant_id   uuid references public.merchants(id) on delete set null,
  priority      int not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.classification_rules is 'Rules to auto-classify imported transactions';

-- 16. monthly_summaries
create table public.monthly_summaries (
  id              uuid primary key default gen_random_uuid(),
  ledger_id       uuid not null references public.ledgers(id) on delete cascade,
  year_month      text not null,                  -- 'YYYY-MM'
  total_income    numeric(18,4) not null default 0,
  total_expense   numeric(18,4) not null default 0,
  total_transfers numeric(18,4) not null default 0,
  net_savings     numeric(18,4) not null default 0,
  currency_code   text not null default 'USD',
  computed_at     timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (ledger_id, year_month)
);
comment on table public.monthly_summaries is 'Pre-aggregated monthly income/expense (transfers excluded)';

-- 17. insights
create table public.insights (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id) on delete cascade,
  title       text not null,
  body        text,
  insight_type text not null default 'general',
  data        jsonb,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.insights is 'AI/rule-generated financial insights';

-- 18. notifications
create table public.notifications (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  ledger_id         uuid references public.ledgers(id) on delete cascade,
  notification_type public.notification_type not null,
  title             text not null,
  body              text,
  data              jsonb,
  is_read           boolean not null default false,
  created_at        timestamptz not null default now()
);
comment on table public.notifications is 'User-facing notifications (budget alerts, system msgs, etc.)';

-- 19. reconciliation_snapshots
create table public.reconciliation_snapshots (
  id                uuid primary key default gen_random_uuid(),
  ledger_id         uuid not null references public.ledgers(id) on delete cascade,
  account_id        uuid not null references public.accounts(id) on delete cascade,
  snapshot_date     date not null,
  statement_balance numeric(18,4) not null,
  computed_balance  numeric(18,4) not null,
  difference        numeric(18,4) not null default 0,
  is_reconciled     boolean not null default false,
  reconciled_by     uuid references auth.users(id) on delete set null,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.reconciliation_snapshots is 'Account reconciliation history snapshots';

-- 20. audit_logs
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id) on delete cascade,
  table_name  text not null,
  record_id   uuid not null,
  action      text not null,                     -- INSERT / UPDATE / DELETE
  actor_id    uuid references auth.users(id) on delete set null,
  before_data jsonb,
  after_data  jsonb,
  created_at  timestamptz not null default now()
);
comment on table public.audit_logs is 'Immutable audit trail of all data mutations';

-- 21. attachments
create table public.attachments (
  id              uuid primary key default gen_random_uuid(),
  ledger_id       uuid not null references public.ledgers(id) on delete cascade,
  transaction_id  uuid references public.transactions(id) on delete set null,
  storage_path    text not null,
  file_name       text not null,
  file_size       bigint,
  mime_type       text,
  uploaded_by     uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.attachments is 'File attachments stored in Supabase Storage';

-- 22. ocr_jobs
create table public.ocr_jobs (
  id              uuid primary key default gen_random_uuid(),
  ledger_id       uuid not null references public.ledgers(id) on delete cascade,
  attachment_id   uuid references public.attachments(id) on delete set null,
  status          public.ocr_status not null default 'pending',
  raw_text        text,
  parsed_data     jsonb,
  error_message   text,
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.ocr_jobs is 'Receipt OCR processing pipeline';

-- 23. export_jobs
create table public.export_jobs (
  id            uuid primary key default gen_random_uuid(),
  ledger_id     uuid not null references public.ledgers(id) on delete cascade,
  format        public.export_format not null default 'csv',
  filters       jsonb,
  status        text not null default 'pending',
  storage_path  text,
  error_message text,
  created_by    uuid not null references auth.users(id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.export_jobs is 'Async data export jobs (CSV, XLSX, PDF, JSON)';

-- 24. month_closures
create table public.month_closures (
  id          uuid primary key default gen_random_uuid(),
  ledger_id   uuid not null references public.ledgers(id) on delete cascade,
  year_month  text not null,                      -- 'YYYY-MM'
  closed_by   uuid not null references auth.users(id) on delete restrict,
  closed_at   timestamptz not null default now(),
  notes       text,
  created_at  timestamptz not null default now(),
  unique (ledger_id, year_month)
);
comment on table public.month_closures is 'Monthly close lock — prevents editor writes to closed periods';

-- ============================================================
-- END 01_enums_tables.sql
-- ============================================================
