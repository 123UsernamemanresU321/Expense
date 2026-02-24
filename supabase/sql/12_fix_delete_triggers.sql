-- ============================================================
-- 12_fix_delete_triggers.sql
-- Fixes BEFORE DELETE triggers that mistakenly return `new` (which is NULL on DELETE).
-- Returning NULL from a BEFORE trigger silently aborts the operation.
-- ============================================================

-- fn_enforce_month_closure
create or replace function public.fn_enforce_month_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger_id uuid;
  v_date date;
begin
  if tg_op = 'DELETE' then
    v_ledger_id := old.ledger_id;
    v_date := old.date;
  else
    v_ledger_id := new.ledger_id;
    v_date := new.date;
  end if;

  if exists (
    select 1 from public.month_closures
    where ledger_id = v_ledger_id
      and year_month = to_char(v_date, 'YYYY-MM')
  ) then
    if not public.is_owner_or_admin(v_ledger_id) then
      raise exception 'Month % is closed for this ledger', to_char(v_date, 'YYYY-MM');
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- fn_enforce_month_closure_splits
create or replace function public.fn_enforce_month_closure_splits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger_id uuid;
  v_date date;
  v_txn_id uuid;
begin
  if tg_op = 'DELETE' then
    v_txn_id := old.transaction_id;
  else
    v_txn_id := new.transaction_id;
  end if;

  select t.ledger_id, t.date into v_ledger_id, v_date
  from public.transactions t where t.id = v_txn_id;

  if exists (
    select 1 from public.month_closures
    where ledger_id = v_ledger_id
      and year_month = to_char(v_date, 'YYYY-MM')
  ) then
    if not public.is_owner_or_admin(v_ledger_id) then
      raise exception 'Month % is closed for this ledger', to_char(v_date, 'YYYY-MM');
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- fn_validate_split_sum
create or replace function public.fn_validate_split_sum()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_txn_id       uuid;
  v_parent_amount numeric;
  v_split_total   numeric;
begin
  if tg_op = 'DELETE' then
    v_txn_id := old.transaction_id;
  else
    v_txn_id := new.transaction_id;
  end if;

  select amount into v_parent_amount
  from public.transactions where id = v_txn_id;

  select coalesce(sum(amount), 0) into v_split_total
  from public.transaction_splits where transaction_id = v_txn_id;

  if coalesce(v_parent_amount, 0) > 0 and v_split_total > v_parent_amount then
    raise exception 'Split total (%) exceeds transaction amount (%)', v_split_total, v_parent_amount;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
