-- ============================================================
-- 14_backfill_summaries.sql
-- One-time backfill of all monthly summaries based on existing transactions.
-- Run this AFTER installing the triggers in script 13.
-- ============================================================

do $$
declare
  r record;
begin
  for r in (select distinct ledger_id, to_char(date, 'YYYY-MM') as ym from public.transactions) loop
    insert into public.monthly_summaries (
      ledger_id, year_month, total_income, total_expense, total_transfers, net_savings, computed_at, updated_at
    ) 
    select 
      r.ledger_id, r.ym,
      coalesce(sum(amount) filter (where txn_type in ('income', 'refund')), 0),
      coalesce(sum(amount) filter (where txn_type = 'expense'), 0),
      coalesce(sum(amount) filter (where txn_type = 'transfer'), 0),
      coalesce(sum(amount) filter (where txn_type in ('income', 'refund')), 0) - coalesce(sum(amount) filter (where txn_type = 'expense'), 0),
      now(), now()
    from public.transactions
    where ledger_id = r.ledger_id and to_char(date, 'YYYY-MM') = r.ym
    on conflict (ledger_id, year_month) do update set
      total_income = excluded.total_income,
      total_expense = excluded.total_expense,
      total_transfers = excluded.total_transfers,
      net_savings = excluded.net_savings,
      computed_at = excluded.computed_at,
      updated_at = excluded.updated_at;
  end loop;
end $$;
