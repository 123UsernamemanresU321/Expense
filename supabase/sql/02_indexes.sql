-- ============================================================
-- 02_indexes.sql
-- Performance indexes for the Personal Finance Dashboard
-- Run SECOND in Supabase Dashboard SQL Editor
-- ============================================================

-- ledger_members: fast lookup by user, by ledger
create index idx_ledger_members_user    on public.ledger_members (user_id);
create index idx_ledger_members_ledger  on public.ledger_members (ledger_id);
create index idx_ledger_members_role    on public.ledger_members (ledger_id, role);

-- accounts
create index idx_accounts_ledger        on public.accounts (ledger_id);
create index idx_accounts_type          on public.accounts (ledger_id, account_type);

-- categories (tree traversal)
create index idx_categories_ledger      on public.categories (ledger_id);
create index idx_categories_parent      on public.categories (parent_id);
create index idx_categories_tree        on public.categories (ledger_id, parent_id, sort_order);

-- tags
create index idx_tags_ledger            on public.tags (ledger_id);

-- merchants
create index idx_merchants_ledger       on public.merchants (ledger_id);
create index idx_merchants_name_search  on public.merchants using gin (to_tsvector('english', name));

-- transactions: the most queried table
create index idx_txn_ledger_date        on public.transactions (ledger_id, date desc);
create index idx_txn_account_date       on public.transactions (account_id, date desc);
create index idx_txn_category           on public.transactions (category_id);
create index idx_txn_merchant           on public.transactions (merchant_id);
create index idx_txn_type               on public.transactions (ledger_id, txn_type);
create index idx_txn_created_by         on public.transactions (created_by);
create index idx_txn_refund_of          on public.transactions (refund_of_id) where refund_of_id is not null;
create index idx_txn_transfer_peer      on public.transactions (transfer_peer_id) where transfer_peer_id is not null;
create index idx_txn_desc_search        on public.transactions using gin (to_tsvector('english', coalesce(description, '')));
-- Composite for monthly aggregation (transfers excluded)
create index idx_txn_ledger_type_date   on public.transactions (ledger_id, txn_type, date);

-- transaction_splits
create index idx_txn_splits_txn         on public.transaction_splits (transaction_id);

-- transaction_tags
create index idx_txn_tags_tag           on public.transaction_tags (tag_id);

-- budgets
create index idx_budgets_ledger         on public.budgets (ledger_id);
create index idx_budgets_category       on public.budgets (category_id);
create index idx_budgets_active         on public.budgets (ledger_id) where is_active = true;

-- budget_alerts
create index idx_budget_alerts_budget   on public.budget_alerts (budget_id);

-- subscriptions
create index idx_subscriptions_ledger   on public.subscriptions (ledger_id);
create index idx_subscriptions_due      on public.subscriptions (next_due_date) where is_active = true;

-- exchange_rates
create index idx_exchange_rates_pair    on public.exchange_rates (base_currency, quote_currency, rate_date desc);

-- classification_rules
create index idx_class_rules_ledger     on public.classification_rules (ledger_id, priority desc);

-- monthly_summaries
create index idx_monthly_summaries_lm   on public.monthly_summaries (ledger_id, year_month);

-- insights
create index idx_insights_ledger        on public.insights (ledger_id);
create index idx_insights_unread        on public.insights (ledger_id) where is_read = false;

-- notifications
create index idx_notifications_user     on public.notifications (user_id, created_at desc);
create index idx_notifications_unread   on public.notifications (user_id) where is_read = false;

-- reconciliation_snapshots
create index idx_recon_ledger_account   on public.reconciliation_snapshots (ledger_id, account_id, snapshot_date desc);

-- audit_logs (immutable, append-only)
create index idx_audit_ledger           on public.audit_logs (ledger_id, created_at desc);
create index idx_audit_table_record     on public.audit_logs (table_name, record_id);
create index idx_audit_actor            on public.audit_logs (actor_id);

-- attachments
create index idx_attachments_ledger     on public.attachments (ledger_id);
create index idx_attachments_txn        on public.attachments (transaction_id);

-- ocr_jobs
create index idx_ocr_jobs_ledger        on public.ocr_jobs (ledger_id);
create index idx_ocr_jobs_status        on public.ocr_jobs (status) where status in ('pending', 'processing');

-- export_jobs
create index idx_export_jobs_ledger     on public.export_jobs (ledger_id);

-- month_closures
create index idx_month_closures_ledger  on public.month_closures (ledger_id, year_month);

-- ============================================================
-- END 02_indexes.sql
-- ============================================================
