-- ============================================================
-- 13_auto_recalculate_triggers.sql
-- Automatically updates account.balance and monthly_summaries 
-- when transactions are inserted, updated, or deleted.
-- ============================================================

-- 1. Helper to calculate the balance delta for a transaction
create or replace function public.fn_get_txn_delta(p_txn public.transactions)
returns numeric
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_txn is null then return 0; end if;
  if p_txn.txn_type in ('income', 'refund', 'adjustment') then return p_txn.amount; end if;
  if p_txn.txn_type = 'expense' then return -p_txn.amount; end if;
  if p_txn.txn_type = 'transfer' and p_txn.description ilike '%in%' then return p_txn.amount; end if;
  if p_txn.txn_type = 'transfer' and p_txn.description ilike '%out%' then return -p_txn.amount; end if;
  -- Default guess for transfer if no description match:
  if p_txn.txn_type = 'transfer' then return -p_txn.amount; end if;
  return 0;
end;
$$;

-- 2. Trigger function to update account balance
create or replace function public.fn_trigger_account_balance()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_delta numeric := 0;
begin
  if tg_op = 'INSERT' then
    v_delta := public.fn_get_txn_delta(new);
    update public.accounts set balance = balance + v_delta where id = new.account_id;
  elsif tg_op = 'DELETE' then
    v_delta := public.fn_get_txn_delta(old);
    update public.accounts set balance = balance - v_delta where id = old.account_id;
  elsif tg_op = 'UPDATE' then
    if old.account_id = new.account_id then
      v_delta := public.fn_get_txn_delta(new) - public.fn_get_txn_delta(old);
      update public.accounts set balance = balance + v_delta where id = new.account_id;
    else
      -- Account changed
      update public.accounts set balance = balance - public.fn_get_txn_delta(old) where id = old.account_id;
      update public.accounts set balance = balance + public.fn_get_txn_delta(new) where id = new.account_id;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_account_balance_update on public.transactions;
create trigger trg_account_balance_update
  after insert or update or delete on public.transactions
  for each row execute function public.fn_trigger_account_balance();

-- 3. Trigger function to completely recalculate the monthly summary for the affected month
create or replace function public.fn_trigger_monthly_summary()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_ledger_id uuid;
  v_month text;
  v_income numeric;
  v_expense numeric;
  v_transfers numeric;
begin
  if tg_op = 'DELETE' then
    v_ledger_id := old.ledger_id;
    v_month := to_char(old.date, 'YYYY-MM');
  else
    v_ledger_id := new.ledger_id;
    v_month := to_char(new.date, 'YYYY-MM');
  end if;

  -- Compute perfectly for the month
  select 
    coalesce(sum(amount) filter (where txn_type in ('income', 'refund')), 0),
    coalesce(sum(amount) filter (where txn_type = 'expense'), 0),
    coalesce(sum(amount) filter (where txn_type = 'transfer'), 0)
  into v_income, v_expense, v_transfers
  from public.transactions
  where ledger_id = v_ledger_id and to_char(date, 'YYYY-MM') = v_month;

  insert into public.monthly_summaries (
    ledger_id, year_month, total_income, total_expense, total_transfers, net_savings, computed_at, updated_at
  ) values (
    v_ledger_id, v_month, v_income, v_expense, v_transfers, v_income - v_expense, now(), now()
  ) on conflict (ledger_id, year_month) do update set
    total_income = excluded.total_income,
    total_expense = excluded.total_expense,
    total_transfers = excluded.total_transfers,
    net_savings = excluded.net_savings,
    computed_at = excluded.computed_at,
    updated_at = excluded.updated_at;

  -- If an update moved a transaction across months, recalculate the old month too
  if tg_op = 'UPDATE' and to_char(old.date, 'YYYY-MM') != to_char(new.date, 'YYYY-MM') then
    v_month := to_char(old.date, 'YYYY-MM');
    
    select 
      coalesce(sum(amount) filter (where txn_type in ('income', 'refund')), 0),
      coalesce(sum(amount) filter (where txn_type = 'expense'), 0),
      coalesce(sum(amount) filter (where txn_type = 'transfer'), 0)
    into v_income, v_expense, v_transfers
    from public.transactions
    where ledger_id = old.ledger_id and to_char(date, 'YYYY-MM') = v_month;

    insert into public.monthly_summaries (
      ledger_id, year_month, total_income, total_expense, total_transfers, net_savings, computed_at, updated_at
    ) values (
      old.ledger_id, v_month, v_income, v_expense, v_transfers, v_income - v_expense, now(), now()
    ) on conflict (ledger_id, year_month) do update set
      total_income = excluded.total_income,
      total_expense = excluded.total_expense,
      total_transfers = excluded.total_transfers,
      net_savings = excluded.net_savings,
      computed_at = excluded.computed_at,
      updated_at = excluded.updated_at;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_monthly_summary_update on public.transactions;
create trigger trg_monthly_summary_update
  after insert or update or delete on public.transactions
  for each row execute function public.fn_trigger_monthly_summary();


