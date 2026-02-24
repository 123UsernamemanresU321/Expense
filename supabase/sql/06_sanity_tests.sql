-- ============================================================
-- 06_sanity_tests.sql
-- Acceptance / Sanity Tests for the Personal Finance Dashboard
-- Run SIXTH (LAST) in Supabase Dashboard SQL Editor
--
-- These queries validate RLS policies, triggers, and domain logic.
-- Each test includes expected outcome comments.
-- ============================================================

-- ============================================================
-- TEST 1: Membership visibility
-- Members of a ledger can see its data; non-members cannot.
-- ============================================================
-- Run as User A (owner) — should see ledger + accounts
-- set request.jwt.claim.sub = '<user_a_uuid>';
select '--- TEST 1: Membership Visibility ---' as test;

select
  l.name as ledger_name,
  lm.role,
  (select count(*) from public.accounts a where a.ledger_id = l.id) as account_count
from public.ledgers l
join public.ledger_members lm on lm.ledger_id = l.id and lm.user_id = auth.uid();

-- Expected: Returns 1 row for "Household Budget" with account_count = 3

-- ============================================================
-- TEST 2: Viewer cannot insert transactions
-- Create a third test user, add as viewer, attempt insert.
-- ============================================================
select '--- TEST 2: Viewer Cannot Insert ---' as test;

-- To test this manually:
-- 1. Create a third user in Supabase Auth
-- 2. Add them as 'viewer' in ledger_members for the seeded ledger
-- 3. Log in as that user and try:
/*
  insert into public.transactions (ledger_id, account_id, txn_type, amount, date, description, created_by)
  values ('<ledger_id>', '<account_id>', 'expense', 10.00, current_date, 'Should fail', auth.uid());
  -- Expected: ERROR due to RLS policy (has_write_access returns false for viewers)
*/

-- Verification query: count viewer's insert capability
select
  'viewer_write_check' as test_name,
  public.has_write_access(lm.ledger_id) as can_write
from public.ledger_members lm
where lm.role = 'viewer'
limit 1;
-- Expected: can_write = false

-- ============================================================
-- TEST 3: Editor can insert transactions in OPEN month
-- ============================================================
select '--- TEST 3: Editor Can Insert in Open Month ---' as test;

-- February 2026 is OPEN (only January is closed in seed data)
-- Run as User B (editor):
/*
  insert into public.transactions (ledger_id, account_id, txn_type, amount, date, description, created_by)
  values ('<ledger_id>', '<acct_id>', 'expense', 15.00, '2026-02-15', 'Editor test open month', auth.uid());
  -- Expected: SUCCESS
*/

-- Verify: check which months are closed
select
  mc.ledger_id,
  mc.year_month,
  mc.closed_by,
  mc.closed_at
from public.month_closures mc;
-- Expected: Only '2026-01' is closed

-- ============================================================
-- TEST 4: Editor BLOCKED in closed month
-- ============================================================
select '--- TEST 4: Editor Blocked in Closed Month ---' as test;

-- January 2026 is CLOSED
-- Run as User B (editor):
/*
  insert into public.transactions (ledger_id, account_id, txn_type, amount, date, description, created_by)
  values ('<ledger_id>', '<acct_id>', 'expense', 20.00, '2026-01-15', 'Should be blocked', auth.uid());
  -- Expected: ERROR — "Month 2026-01 is closed for ledger..."
*/

-- Verify month closure status
select
  'month_closure_check' as test_name,
  public.is_month_closed(mc.ledger_id, '2026-01-15'::date) as jan_closed,
  public.is_month_closed(mc.ledger_id, '2026-02-15'::date) as feb_closed
from public.month_closures mc
limit 1;
-- Expected: jan_closed = true, feb_closed = false

-- ============================================================
-- TEST 5: Owner/Admin allowed in closed month
-- ============================================================
select '--- TEST 5: Owner/Admin Allowed in Closed Month ---' as test;

-- Run as User A (owner):
/*
  insert into public.transactions (ledger_id, account_id, txn_type, amount, date, description, created_by)
  values ('<ledger_id>', '<acct_id>', 'adjustment', 100.00, '2026-01-20', 'Owner adjustment in closed month', auth.uid());
  -- Expected: SUCCESS (owner bypasses month closure)
*/

-- Verify owner/admin check
select
  'owner_admin_check' as test_name,
  lm.user_id,
  lm.role,
  public.is_owner_or_admin(lm.ledger_id) as is_admin_or_owner
from public.ledger_members lm
where lm.role in ('owner', 'admin');
-- Expected: owner shows is_admin_or_owner = true (when run as that user)

-- ============================================================
-- TEST 6: Refund linkage query
-- Find all refunds and their original transactions
-- ============================================================
select '--- TEST 6: Refund Linkage ---' as test;

select
  r.id as refund_id,
  r.amount as refund_amount,
  r.description as refund_desc,
  r.date as refund_date,
  o.id as original_id,
  o.amount as original_amount,
  o.description as original_desc,
  o.date as original_date,
  o.merchant_id
from public.transactions r
join public.transactions o on o.id = r.refund_of_id
where r.txn_type = 'refund';
-- Expected: 1 row — $45 refund linked to "Damaged goods purchase"

-- ============================================================
-- TEST 7: Split sum validation query
-- Verify splits sum equals parent transaction amount
-- ============================================================
select '--- TEST 7: Split Sum Validation ---' as test;

select
  t.id as transaction_id,
  t.amount as parent_amount,
  t.description,
  coalesce(sum(s.amount), 0) as split_sum,
  t.amount - coalesce(sum(s.amount), 0) as unallocated,
  case
    when coalesce(sum(s.amount), 0) = t.amount then '✅ BALANCED'
    when coalesce(sum(s.amount), 0) < t.amount then '⚠️ UNDER-ALLOCATED'
    else '❌ OVER-ALLOCATED'
  end as status
from public.transactions t
left join public.transaction_splits s on s.transaction_id = t.id
where t.is_split = true
group by t.id, t.amount, t.description;
-- Expected: "Team dinner + drinks" = $85, split_sum = $85 (55 + 30), status = ✅ BALANCED

-- ============================================================
-- TEST 8: Transfer exclusion summary query
-- Monthly income/expense totals EXCLUDING transfers
-- ============================================================
select '--- TEST 8: Transfer Exclusion Summary ---' as test;

select
  t.ledger_id,
  to_char(t.date, 'YYYY-MM') as month,
  sum(case when t.txn_type = 'income' then t.amount else 0 end) as total_income,
  sum(case when t.txn_type = 'expense' then t.amount else 0 end) as total_expense,
  sum(case when t.txn_type = 'refund' then t.amount else 0 end) as total_refunds,
  sum(case when t.txn_type = 'transfer' then t.amount else 0 end) as total_transfers_excluded,
  sum(case when t.txn_type = 'income' then t.amount else 0 end)
    - sum(case when t.txn_type = 'expense' then t.amount else 0 end)
    + sum(case when t.txn_type = 'refund' then t.amount else 0 end) as net_savings
from public.transactions t
where t.txn_type != 'transfer'  -- exclude transfers from totals
  or t.txn_type = 'transfer'    -- but still show transfer total separately
group by t.ledger_id, to_char(t.date, 'YYYY-MM')
order by month;

-- Better version: true income/expense only
select
  '--- Net savings (transfers excluded) ---' as label,
  to_char(t.date, 'YYYY-MM') as month,
  sum(case when t.txn_type = 'income' then t.amount else 0 end) as income,
  sum(case when t.txn_type = 'expense' then t.amount else 0 end) as expenses,
  sum(case when t.txn_type = 'refund' then t.amount else 0 end) as refunds,
  sum(case when t.txn_type = 'income' then t.amount else 0 end)
    - sum(case when t.txn_type = 'expense' then t.amount else 0 end)
    + sum(case when t.txn_type = 'refund' then t.amount else 0 end) as net
from public.transactions t
where t.txn_type not in ('transfer', 'adjustment')
group by to_char(t.date, 'YYYY-MM');
-- Expected: Feb 2026 — income: 5300, expenses: 287.75, refunds: 45, net ≈ 5057.25

-- ============================================================
-- TEST 9: Monthly summary aggregation query
-- Recompute monthly summary from raw transactions
-- ============================================================
select '--- TEST 9: Monthly Summary Aggregation ---' as test;

with computed as (
  select
    t.ledger_id,
    to_char(t.date, 'YYYY-MM') as year_month,
    sum(case when t.txn_type = 'income'   then t.amount else 0 end) as total_income,
    sum(case when t.txn_type = 'expense'  then t.amount else 0 end) as total_expense,
    sum(case when t.txn_type = 'transfer' then t.amount else 0 end) / 2 as total_transfers, -- divide by 2 since both sides recorded
    sum(case when t.txn_type = 'income'   then t.amount else 0 end)
      - sum(case when t.txn_type = 'expense' then t.amount else 0 end)
      + sum(case when t.txn_type = 'refund'  then t.amount else 0 end) as net_savings
  from public.transactions t
  group by t.ledger_id, to_char(t.date, 'YYYY-MM')
)
select
  c.year_month,
  c.total_income  as computed_income,
  ms.total_income as stored_income,
  c.total_expense as computed_expense,
  ms.total_expense as stored_expense,
  c.total_transfers as computed_transfers,
  ms.total_transfers as stored_transfers,
  case
    when c.total_income = ms.total_income
     and c.total_expense = ms.total_expense then '✅ MATCH'
    else '❌ MISMATCH'
  end as validation
from computed c
left join public.monthly_summaries ms
  on ms.ledger_id = c.ledger_id and ms.year_month = c.year_month
where c.year_month = '2026-02';
-- Expected: computed values match stored monthly_summaries for 2026-02

-- ============================================================
-- BONUS: Audit log inspection
-- Verify audit trail was recorded for seeded data
-- ============================================================
select '--- BONUS: Audit Log Check ---' as test;

select
  al.table_name,
  al.action,
  count(*) as entry_count
from public.audit_logs al
group by al.table_name, al.action
order by al.table_name, al.action;
-- Expected: INSERT rows for accounts, transactions, etc.

-- ============================================================
-- SUMMARY
-- ============================================================
select '============================================' as divider;
select 'All sanity tests completed.' as result;
select 'Review results above for ✅ / ❌ indicators.' as instructions;
select '============================================' as divider;
