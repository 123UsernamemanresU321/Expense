-- 15_fix_trigger_currency_conversion.sql

-- 0. Fix search_path warning on previously defined fn_get_txn_delta
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
  if p_txn.txn_type = 'transfer' then return -p_txn.amount; end if;
  return 0;
end;
$$;

-- 1. Create a function to convert currency using the exchange_rates table
create or replace function public.fn_convert_currency(p_amount numeric, p_from text, p_to text, p_date date default null)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_rate numeric;
begin
  if p_from is null or p_to is null or p_from = p_to then
    return p_amount;
  end if;

  -- 1. Try exact date match or most recent before date
  select rate into v_rate
  from public.exchange_rates
  where base_currency = p_from and quote_currency = p_to and rate_date <= coalesce(p_date, current_date)
  order by rate_date desc
  limit 1;

  if v_rate is not null then
    return p_amount * v_rate;
  end if;

  -- 2. Fallback to any recent rate if looking back failed
  select rate into v_rate
  from public.exchange_rates
  where base_currency = p_from and quote_currency = p_to
  order by rate_date desc
  limit 1;

  if v_rate is not null then
    return p_amount * v_rate;
  end if;

  -- 3. Last resort fallback
  return p_amount;
end;
$$;

-- 2. Update fn_trigger_account_balance to use fn_convert_currency
create or replace function public.fn_trigger_account_balance()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_delta numeric := 0;
  v_acct_currency text;
begin
  if tg_op = 'INSERT' then
    select currency_code into v_acct_currency from public.accounts where id = new.account_id;
    v_delta := public.fn_convert_currency(public.fn_get_txn_delta(new), new.currency_code, v_acct_currency, new.date);
    update public.accounts set balance = balance + v_delta where id = new.account_id;
  elsif tg_op = 'DELETE' then
    select currency_code into v_acct_currency from public.accounts where id = old.account_id;
    v_delta := public.fn_convert_currency(public.fn_get_txn_delta(old), old.currency_code, v_acct_currency, old.date);
    update public.accounts set balance = balance - v_delta where id = old.account_id;
  elsif tg_op = 'UPDATE' then
    if old.account_id = new.account_id then
      select currency_code into v_acct_currency from public.accounts where id = new.account_id;
      
      -- Convert both old and new using their respective currencies/dates
      v_delta := public.fn_convert_currency(public.fn_get_txn_delta(new), new.currency_code, v_acct_currency, new.date)
                 - public.fn_convert_currency(public.fn_get_txn_delta(old), old.currency_code, v_acct_currency, old.date);
      update public.accounts set balance = balance + v_delta where id = new.account_id;
    else
      -- Account changed
      declare
        v_old_acct_currency text;
        v_new_acct_currency text;
      begin
        select currency_code into v_old_acct_currency from public.accounts where id = old.account_id;
        select currency_code into v_new_acct_currency from public.accounts where id = new.account_id;
        
        update public.accounts set balance = balance - public.fn_convert_currency(public.fn_get_txn_delta(old), old.currency_code, v_old_acct_currency, old.date) where id = old.account_id;
        update public.accounts set balance = balance + public.fn_convert_currency(public.fn_get_txn_delta(new), new.currency_code, v_new_acct_currency, new.date) where id = new.account_id;
      end;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- 3. Update fn_trigger_monthly_summary to convert amounts to ledger currency
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
  v_ledger_currency text;
begin
  if tg_op = 'DELETE' then
    v_ledger_id := old.ledger_id;
    v_month := to_char(old.date, 'YYYY-MM');
  else
    v_ledger_id := new.ledger_id;
    v_month := to_char(new.date, 'YYYY-MM');
  end if;

  select currency_code into v_ledger_currency from public.ledgers where id = v_ledger_id;

  -- Compute perfectly for the month, converting each transaction to ledger currency
  select 
    coalesce(sum(public.fn_convert_currency(amount, currency_code, v_ledger_currency, date)) filter (where txn_type in ('income', 'refund')), 0),
    coalesce(sum(public.fn_convert_currency(amount, currency_code, v_ledger_currency, date)) filter (where txn_type = 'expense'), 0),
    coalesce(sum(public.fn_convert_currency(amount, currency_code, v_ledger_currency, date)) filter (where txn_type = 'transfer'), 0)
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
      coalesce(sum(public.fn_convert_currency(amount, currency_code, v_ledger_currency, date)) filter (where txn_type in ('income', 'refund')), 0),
      coalesce(sum(public.fn_convert_currency(amount, currency_code, v_ledger_currency, date)) filter (where txn_type = 'expense'), 0),
      coalesce(sum(public.fn_convert_currency(amount, currency_code, v_ledger_currency, date)) filter (where txn_type = 'transfer'), 0)
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

-- 4. Backfill account balances correctly
do $$
declare
  r record;
  v_acct_curr text;
  v_new_bal numeric;
begin
  for r in select id from public.accounts loop
    select currency_code into v_acct_curr from public.accounts where id = r.id;
    
    select coalesce(sum(public.fn_convert_currency(public.fn_get_txn_delta(t), t.currency_code, v_acct_curr, t.date)), 0)
    into v_new_bal
    from public.transactions t
    where t.account_id = r.id;

    update public.accounts set balance = v_new_bal where id = r.id;
  end loop;
end;
$$;

-- 5. Backfill monthly summaries correctly
do $$
declare
  r record;
  v_month text;
  v_income numeric;
  v_expense numeric;
  v_transfers numeric;
  v_ledger_curr text;
begin
  for r in select id from public.ledgers loop
    select currency_code into v_ledger_curr from public.ledgers where id = r.id;

    -- Update each monthly summary
    for v_month in select distinct to_char(date, 'YYYY-MM') from public.transactions where ledger_id = r.id loop
      select 
        coalesce(sum(public.fn_convert_currency(amount, currency_code, v_ledger_curr, date)) filter (where txn_type in ('income', 'refund')), 0),
        coalesce(sum(public.fn_convert_currency(amount, currency_code, v_ledger_curr, date)) filter (where txn_type = 'expense'), 0),
        coalesce(sum(public.fn_convert_currency(amount, currency_code, v_ledger_curr, date)) filter (where txn_type = 'transfer'), 0)
      into v_income, v_expense, v_transfers
      from public.transactions
      where ledger_id = r.id and to_char(date, 'YYYY-MM') = v_month;

      update public.monthly_summaries
      set total_income = v_income,
          total_expense = v_expense,
          total_transfers = v_transfers,
          net_savings = v_income - v_expense
      where ledger_id = r.id and year_month = v_month;
    end loop;
  end loop;
end;
$$;
