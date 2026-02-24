-- ============================================================
-- 03_triggers.sql
-- Trigger functions for the Personal Finance Dashboard
-- Run THIRD in Supabase Dashboard SQL Editor
-- ============================================================

-- ============================================================
-- A) UPDATED_AT AUTO-TIMESTAMP
-- ============================================================
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to every table that has updated_at
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'profiles','ledgers','ledger_members','accounts','categories',
      'tags','merchants','transactions','transaction_splits',
      'budgets','budget_alerts','subscriptions','classification_rules',
      'monthly_summaries','insights','reconciliation_snapshots',
      'attachments','ocr_jobs','export_jobs'
    ])
  loop
    execute format(
      'create trigger trg_%s_updated_at
         before update on public.%I
         for each row execute function public.fn_set_updated_at()',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================
-- B) AUTO-CREATE PROFILE ON AUTH SIGNUP
-- ============================================================
create or replace function public.fn_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_handle_new_user();

-- ============================================================
-- C) AUDIT LOG TRIGGER
-- Records INSERT / UPDATE / DELETE with before/after JSON
-- Applied to financial tables
-- ============================================================
create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
as $$
declare
  v_ledger_id  uuid;
  v_record_id  uuid;
  v_before     jsonb;
  v_after      jsonb;
  v_actor      uuid;
begin
  -- Determine actor — auth.uid() in RLS context, null in direct SQL
  v_actor := auth.uid();

  if tg_op = 'DELETE' then
    v_record_id := old.id;
    v_before    := to_jsonb(old);
    v_after     := null;
    -- Try to get ledger_id from old row
    v_ledger_id := old.ledger_id;
  elsif tg_op = 'INSERT' then
    v_record_id := new.id;
    v_before    := null;
    v_after     := to_jsonb(new);
    v_ledger_id := new.ledger_id;
  else -- UPDATE
    v_record_id := new.id;
    v_before    := to_jsonb(old);
    v_after     := to_jsonb(new);
    v_ledger_id := new.ledger_id;
  end if;

  insert into public.audit_logs (ledger_id, table_name, record_id, action, actor_id, before_data, after_data)
  values (v_ledger_id, tg_table_name, v_record_id, tg_op, v_actor, v_before, v_after);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- Apply audit trigger to core financial tables
do $$
declare
  t text;
begin
  for t in
    select unnest(array[
      'accounts','transactions','transaction_splits',
      'budgets','subscriptions','categories','merchants',
      'month_closures','reconciliation_snapshots'
    ])
  loop
    execute format(
      'create trigger trg_%s_audit
         after insert or update or delete on public.%I
         for each row execute function public.fn_audit_log()',
      t, t
    );
  end loop;
end;
$$;

-- ============================================================
-- D) SPLIT SUM VALIDATION
-- Ensures split amounts sum to parent transaction amount
-- Fires AFTER INSERT/UPDATE/DELETE on transaction_splits
-- ============================================================
create or replace function public.fn_validate_split_sum()
returns trigger
language plpgsql
security definer
as $$
declare
  v_txn_id       uuid;
  v_parent_amount numeric(18,4);
  v_split_sum     numeric(18,4);
begin
  -- Determine which transaction to validate
  if tg_op = 'DELETE' then
    v_txn_id := old.transaction_id;
  else
    v_txn_id := new.transaction_id;
  end if;

  -- Get parent transaction amount and is_split flag
  select amount into v_parent_amount
  from public.transactions
  where id = v_txn_id and is_split = true;

  -- If parent is not marked as split, skip validation
  if not found then
    return coalesce(new, old);
  end if;

  -- Sum all splits for this transaction
  select coalesce(sum(amount), 0) into v_split_sum
  from public.transaction_splits
  where transaction_id = v_txn_id;

  -- Validate: split sum must not exceed parent amount
  if v_split_sum > v_parent_amount then
    raise exception 'Split sum (%) exceeds transaction amount (%) for txn %',
      v_split_sum, v_parent_amount, v_txn_id;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger trg_split_sum_check
  after insert or update or delete on public.transaction_splits
  for each row execute function public.fn_validate_split_sum();

-- ============================================================
-- E) MONTH CLOSURE ENFORCEMENT (TRIGGER-BASED)
-- Blocks editors from modifying transactions in closed months.
-- Owner/admin bypass is handled at the RLS level, but this
-- trigger provides a safety net for any direct SQL mutations.
-- ============================================================
create or replace function public.fn_enforce_month_closure()
returns trigger
language plpgsql
security definer
as $$
declare
  v_ledger_id  uuid;
  v_txn_date   date;
  v_year_month text;
  v_is_closed  boolean;
  v_user_role  public.ledger_role;
begin
  -- Determine the relevant values
  if tg_op = 'DELETE' then
    v_ledger_id := old.ledger_id;
    v_txn_date  := old.date;
  else
    v_ledger_id := new.ledger_id;
    v_txn_date  := new.date;
  end if;

  v_year_month := to_char(v_txn_date, 'YYYY-MM');

  -- Check if this month is closed
  select true into v_is_closed
  from public.month_closures
  where ledger_id = v_ledger_id and year_month = v_year_month;

  if not found then
    -- Month is open — allow
    return coalesce(new, old);
  end if;

  -- Month is closed — check if actor is owner/admin
  select role into v_user_role
  from public.ledger_members
  where ledger_id = v_ledger_id and user_id = auth.uid();

  if v_user_role in ('owner', 'admin') then
    -- Owner/admin can still modify closed months
    return coalesce(new, old);
  end if;

  raise exception 'Month % is closed for ledger %. Only owner/admin can modify transactions in closed months.',
    v_year_month, v_ledger_id;
end;
$$;

create trigger trg_txn_month_closure
  before insert or update or delete on public.transactions
  for each row execute function public.fn_enforce_month_closure();

-- Also protect transaction_splits in closed months
create or replace function public.fn_enforce_month_closure_splits()
returns trigger
language plpgsql
security definer
as $$
declare
  v_txn_date   date;
  v_ledger_id  uuid;
  v_year_month text;
  v_is_closed  boolean;
  v_user_role  public.ledger_role;
  v_txn_id     uuid;
begin
  if tg_op = 'DELETE' then
    v_txn_id := old.transaction_id;
  else
    v_txn_id := new.transaction_id;
  end if;

  select date, ledger_id into v_txn_date, v_ledger_id
  from public.transactions
  where id = v_txn_id;

  if not found then
    return coalesce(new, old);
  end if;

  v_year_month := to_char(v_txn_date, 'YYYY-MM');

  select true into v_is_closed
  from public.month_closures
  where ledger_id = v_ledger_id and year_month = v_year_month;

  if not found then
    return coalesce(new, old);
  end if;

  select role into v_user_role
  from public.ledger_members
  where ledger_id = v_ledger_id and user_id = auth.uid();

  if v_user_role in ('owner', 'admin') then
    return coalesce(new, old);
  end if;

  raise exception 'Cannot modify splits: month % is closed for ledger %.',
    v_year_month, v_ledger_id;
end;
$$;

create trigger trg_split_month_closure
  before insert or update or delete on public.transaction_splits
  for each row execute function public.fn_enforce_month_closure_splits();

-- ============================================================
-- F) AUTO-ADD OWNER AS MEMBER WHEN LEDGER CREATED
-- ============================================================
create or replace function public.fn_auto_add_ledger_owner()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.ledger_members (ledger_id, user_id, role, invited_by)
  values (new.id, new.created_by, 'owner', new.created_by);
  return new;
end;
$$;

create trigger trg_ledger_auto_owner
  after insert on public.ledgers
  for each row execute function public.fn_auto_add_ledger_owner();

-- ============================================================
-- END 03_triggers.sql
-- ============================================================
