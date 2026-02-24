-- ============================================================
-- 05_seed.sql
-- Demo seed data for the Personal Finance Dashboard
-- Run FIFTH in Supabase Dashboard SQL Editor
--
-- ⚠️  IMPORTANT: Before running this file you MUST:
--   1. Create two test users in Supabase Auth (Dashboard → Authentication → Users)
--   2. Replace the placeholder UUIDs below with the real user IDs
-- ============================================================

-- ============================================================
-- PLACEHOLDER USER IDs — REPLACE THESE!
-- ============================================================
-- User A (owner) — Eric's account
-- User B (editor) — demo/test user (create in Supabase Auth or remove)

do $$
declare
  v_user_a   uuid := 'ab3df27c-c15a-415f-a3d1-3709e8ba39fe'; -- Eric (owner)
  v_user_b   uuid := '00000000-0000-0000-0000-000000000002'; -- REPLACE with a second user or remove editor lines
  v_ledger   uuid;
  v_acct_chk uuid;
  v_acct_cc  uuid;
  v_acct_sav uuid;
  v_cat_food uuid;
  v_cat_rest uuid;
  v_cat_groc uuid;
  v_cat_transport uuid;
  v_cat_salary uuid;
  v_cat_freelance uuid;
  v_cat_housing uuid;
  v_cat_utils uuid;
  v_cat_entertainment uuid;
  v_cat_health uuid;
  v_tag_tax uuid;
  v_tag_biz uuid;
  v_tag_personal uuid;
  v_merch_amz uuid;
  v_merch_uber uuid;
  v_merch_star uuid;
  v_txn_1 uuid;
  v_txn_2 uuid;
  v_txn_3 uuid;
  v_txn_4 uuid;
  v_txn_5 uuid;
  v_txn_transfer_a uuid;
  v_txn_transfer_b uuid;
  v_txn_refund_orig uuid;
  v_txn_refund uuid;
  v_txn_split uuid;
  v_budget_food uuid;
begin
  -- ============================================================
  -- PROFILES (normally auto-created by trigger, but seed manually)
  -- ============================================================
  insert into public.profiles (id, email, display_name, currency_code)
  values (v_user_a, 'eric@example.com', 'Eric', 'USD')
  on conflict (id) do update set display_name = excluded.display_name;

  -- Only insert User B if you created a second test user
  -- insert into public.profiles (id, email, display_name, currency_code)
  -- values (v_user_b, 'bob@example.com', 'Bob', 'USD')
  -- on conflict (id) do nothing;

  -- ============================================================
  -- LEDGER (one shared ledger)
  -- ============================================================
  v_ledger := gen_random_uuid();
  insert into public.ledgers (id, name, description, currency_code, created_by)
  values (v_ledger, 'Household Budget', 'Shared household finances', 'USD', v_user_a);

  -- Trigger auto-adds owner; add editor only if you have a second user
  -- insert into public.ledger_members (ledger_id, user_id, role, invited_by)
  -- values (v_ledger, v_user_b, 'editor', v_user_a);

  -- ============================================================
  -- ACCOUNTS
  -- ============================================================
  v_acct_chk := gen_random_uuid();
  v_acct_cc  := gen_random_uuid();
  v_acct_sav := gen_random_uuid();

  insert into public.accounts (id, ledger_id, name, account_type, currency_code, balance, sort_order)
  values
    (v_acct_chk, v_ledger, 'Checking Account', 'checking', 'USD', 5000.00, 1),
    (v_acct_cc,  v_ledger, 'Visa Credit Card', 'credit_card', 'USD', -1200.00, 2),
    (v_acct_sav, v_ledger, 'Savings Account', 'savings', 'USD', 15000.00, 3);

  -- ============================================================
  -- CATEGORIES (tree)
  -- ============================================================
  -- Top-level expense categories
  v_cat_food          := gen_random_uuid();
  v_cat_transport     := gen_random_uuid();
  v_cat_housing       := gen_random_uuid();
  v_cat_entertainment := gen_random_uuid();
  v_cat_health        := gen_random_uuid();
  v_cat_utils         := gen_random_uuid();

  insert into public.categories (id, ledger_id, parent_id, name, icon, color, is_income, sort_order)
  values
    (v_cat_food,          v_ledger, null, 'Food & Dining',   '🍔', '#FF6B6B', false, 1),
    (v_cat_transport,     v_ledger, null, 'Transportation',  '🚗', '#4ECDC4', false, 2),
    (v_cat_housing,       v_ledger, null, 'Housing',         '🏠', '#45B7D1', false, 3),
    (v_cat_entertainment, v_ledger, null, 'Entertainment',   '🎬', '#96CEB4', false, 4),
    (v_cat_health,        v_ledger, null, 'Health',          '🏥', '#FFEAA7', false, 5),
    (v_cat_utils,         v_ledger, null, 'Utilities',       '⚡', '#DDA0DD', false, 6);

  -- Sub-categories under Food
  v_cat_rest := gen_random_uuid();
  v_cat_groc := gen_random_uuid();

  insert into public.categories (id, ledger_id, parent_id, name, icon, color, is_income, sort_order)
  values
    (v_cat_rest, v_ledger, v_cat_food, 'Restaurants',  '🍽️', '#FF6B6B', false, 1),
    (v_cat_groc, v_ledger, v_cat_food, 'Groceries',    '🛒', '#FF8E8E', false, 2);

  -- Income categories
  v_cat_salary    := gen_random_uuid();
  v_cat_freelance := gen_random_uuid();

  insert into public.categories (id, ledger_id, parent_id, name, icon, color, is_income, sort_order)
  values
    (v_cat_salary,    v_ledger, null, 'Salary',    '💰', '#2ECC71', true, 10),
    (v_cat_freelance, v_ledger, null, 'Freelance', '💻', '#27AE60', true, 11);

  -- ============================================================
  -- TAGS
  -- ============================================================
  v_tag_tax      := gen_random_uuid();
  v_tag_biz      := gen_random_uuid();
  v_tag_personal := gen_random_uuid();

  insert into public.tags (id, ledger_id, name, color)
  values
    (v_tag_tax,      v_ledger, 'tax-deductible', '#F39C12'),
    (v_tag_biz,      v_ledger, 'business',       '#3498DB'),
    (v_tag_personal, v_ledger, 'personal',       '#E74C3C');

  -- ============================================================
  -- MERCHANTS
  -- ============================================================
  v_merch_amz  := gen_random_uuid();
  v_merch_uber := gen_random_uuid();
  v_merch_star := gen_random_uuid();

  insert into public.merchants (id, ledger_id, name, category_id, website)
  values
    (v_merch_amz,  v_ledger, 'Amazon',    v_cat_groc,      'https://amazon.com'),
    (v_merch_uber, v_ledger, 'Uber',      v_cat_transport, 'https://uber.com'),
    (v_merch_star, v_ledger, 'Starbucks', v_cat_rest,      'https://starbucks.com');

  -- ============================================================
  -- TRANSACTIONS
  -- ============================================================

  -- 1. Salary income
  v_txn_1 := gen_random_uuid();
  insert into public.transactions (id, ledger_id, account_id, category_id, txn_type, amount, date, description, created_by)
  values (v_txn_1, v_ledger, v_acct_chk, v_cat_salary, 'income', 4500.00, '2026-02-01', 'February salary', v_user_a);

  -- 2. Grocery expense
  v_txn_2 := gen_random_uuid();
  insert into public.transactions (id, ledger_id, account_id, category_id, merchant_id, txn_type, amount, date, description, created_by)
  values (v_txn_2, v_ledger, v_acct_cc, v_cat_groc, v_merch_amz, 'expense', 127.50, '2026-02-03', 'Weekly groceries', v_user_a);

  -- 3. Uber ride
  v_txn_3 := gen_random_uuid();
  insert into public.transactions (id, ledger_id, account_id, category_id, merchant_id, txn_type, amount, date, description, created_by)
  values (v_txn_3, v_ledger, v_acct_cc, v_cat_transport, v_merch_uber, 'expense', 24.50, '2026-02-04', 'Uber to airport', v_user_b);

  -- 4. Coffee
  v_txn_4 := gen_random_uuid();
  insert into public.transactions (id, ledger_id, account_id, category_id, merchant_id, txn_type, amount, date, description, created_by)
  values (v_txn_4, v_ledger, v_acct_cc, v_cat_rest, v_merch_star, 'expense', 5.75, '2026-02-05', 'Latte', v_user_b);

  -- 5. Freelance income
  v_txn_5 := gen_random_uuid();
  insert into public.transactions (id, ledger_id, account_id, category_id, txn_type, amount, date, description, created_by)
  values (v_txn_5, v_ledger, v_acct_chk, v_cat_freelance, 'income', 800.00, '2026-02-10', 'Web project payment', v_user_a);

  -- 6. Transfer: checking → savings
  v_txn_transfer_a := gen_random_uuid();
  v_txn_transfer_b := gen_random_uuid();

  insert into public.transactions (id, ledger_id, account_id, txn_type, amount, date, description, transfer_peer_id, created_by)
  values
    (v_txn_transfer_a, v_ledger, v_acct_chk, 'transfer', 1000.00, '2026-02-05', 'Transfer to savings', v_txn_transfer_b, v_user_a),
    (v_txn_transfer_b, v_ledger, v_acct_sav, 'transfer', 1000.00, '2026-02-05', 'Transfer from checking', v_txn_transfer_a, v_user_a);

  -- 7. Refund — original purchase + refund
  v_txn_refund_orig := gen_random_uuid();
  insert into public.transactions (id, ledger_id, account_id, category_id, merchant_id, txn_type, amount, date, description, created_by)
  values (v_txn_refund_orig, v_ledger, v_acct_cc, v_cat_groc, v_merch_amz, 'expense', 45.00, '2026-02-06', 'Damaged goods purchase', v_user_a);

  v_txn_refund := gen_random_uuid();
  insert into public.transactions (id, ledger_id, account_id, category_id, merchant_id, txn_type, amount, date, description, refund_of_id, created_by)
  values (v_txn_refund, v_ledger, v_acct_cc, v_cat_groc, v_merch_amz, 'refund', 45.00, '2026-02-08', 'Refund for damaged goods', v_txn_refund_orig, v_user_a);

  -- 8. Split transaction (dinner shared across categories)
  v_txn_split := gen_random_uuid();
  insert into public.transactions (id, ledger_id, account_id, category_id, txn_type, amount, date, description, is_split, created_by)
  values (v_txn_split, v_ledger, v_acct_cc, v_cat_rest, 'expense', 85.00, '2026-02-07', 'Team dinner + drinks', true, v_user_a);

  insert into public.transaction_splits (transaction_id, category_id, amount, description)
  values
    (v_txn_split, v_cat_rest,          55.00, 'Food portion'),
    (v_txn_split, v_cat_entertainment, 30.00, 'Drinks portion');

  -- ============================================================
  -- TAG SOME TRANSACTIONS
  -- ============================================================
  insert into public.transaction_tags (transaction_id, tag_id)
  values
    (v_txn_3, v_tag_biz),           -- Uber tagged as business
    (v_txn_5, v_tag_tax),           -- Freelance tagged as tax-deductible
    (v_txn_4, v_tag_personal);      -- Coffee tagged as personal

  -- ============================================================
  -- BUDGETS
  -- ============================================================
  v_budget_food := gen_random_uuid();
  insert into public.budgets (id, ledger_id, category_id, name, amount, period, start_date)
  values
    (v_budget_food, v_ledger, v_cat_food, 'Food Budget', 500.00, 'monthly', '2026-02-01');

  insert into public.budget_alerts (budget_id, threshold_pct)
  values
    (v_budget_food, 75.00),
    (v_budget_food, 100.00);

  -- ============================================================
  -- SUBSCRIPTIONS
  -- ============================================================
  insert into public.subscriptions (ledger_id, account_id, name, amount, interval, next_due_date, is_active, notes)
  values
    (v_ledger, v_acct_cc, 'Netflix',   15.99, 'monthly', '2026-03-01', true, 'Family plan'),
    (v_ledger, v_acct_cc, 'Spotify',   9.99,  'monthly', '2026-03-05', true, null),
    (v_ledger, v_acct_chk, 'Gym',      49.99, 'monthly', '2026-03-01', true, 'Annual commitment');

  -- ============================================================
  -- EXCHANGE RATES
  -- ============================================================
  insert into public.exchange_rates (base_currency, quote_currency, rate, rate_date, source)
  values
    ('USD', 'EUR', 0.92150000, '2026-02-24', 'seed'),
    ('USD', 'GBP', 0.79300000, '2026-02-24', 'seed'),
    ('EUR', 'USD', 1.08520000, '2026-02-24', 'seed');

  -- ============================================================
  -- CLASSIFICATION RULES
  -- ============================================================
  insert into public.classification_rules (ledger_id, match_field, match_pattern, category_id, merchant_id, priority, is_active)
  values
    (v_ledger, 'description', '%uber%',      v_cat_transport, v_merch_uber, 10, true),
    (v_ledger, 'description', '%starbucks%',  v_cat_rest,      v_merch_star, 10, true),
    (v_ledger, 'description', '%amazon%',     v_cat_groc,      v_merch_amz,  5,  true);

  -- ============================================================
  -- MONTHLY SUMMARY (pre-computed for February)
  -- Transfers excluded from income/expense totals
  -- ============================================================
  insert into public.monthly_summaries (ledger_id, year_month, total_income, total_expense, total_transfers, net_savings, currency_code)
  values (v_ledger, '2026-02', 5300.00, 287.75, 1000.00, 5012.25, 'USD');

  -- ============================================================
  -- MONTH CLOSURE (close January to demo locking)
  -- ============================================================
  insert into public.month_closures (ledger_id, year_month, closed_by, notes)
  values (v_ledger, '2026-01', v_user_a, 'January books closed');

  -- ============================================================
  -- NOTIFICATIONS
  -- ============================================================
  insert into public.notifications (user_id, ledger_id, notification_type, title, body)
  values
    (v_user_a, v_ledger, 'member_added', 'New member joined', 'Bob has joined Household Budget as editor'),
    (v_user_a, v_ledger, 'budget_warning', 'Food budget at 75%', 'You have spent $375 of your $500 food budget');

  raise notice 'Seed data inserted successfully! Ledger ID: %', v_ledger;
end;
$$;
