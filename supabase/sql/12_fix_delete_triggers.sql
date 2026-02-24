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
