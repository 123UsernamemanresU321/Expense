-- ============================================================
-- 04_rls_policies.sql
-- Row Level Security policies for the Personal Finance Dashboard
-- Run FOURTH in Supabase Dashboard SQL Editor
-- ============================================================

-- ============================================================
-- HELPER FUNCTIONS (used in policies)
-- ============================================================

-- Returns true if current user is a member of the given ledger
create or replace function public.is_ledger_member(p_ledger_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id and user_id = auth.uid()
  );
$$;

-- Returns the role of the current user in the given ledger (null if not a member)
create or replace function public.get_ledger_role(p_ledger_id uuid)
returns public.ledger_role
language sql
security definer
stable
as $$
  select role from public.ledger_members
  where ledger_id = p_ledger_id and user_id = auth.uid();
$$;

-- Returns true if the current user has a write-capable role (not viewer)
create or replace function public.has_write_access(p_ledger_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id
      and user_id = auth.uid()
      and role in ('owner', 'admin', 'editor')
  );
$$;

-- Returns true if the current user is owner or admin of the ledger
create or replace function public.is_owner_or_admin(p_ledger_id uuid)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id
      and user_id = auth.uid()
      and role in ('owner', 'admin')
  );
$$;

-- Returns true if a month is closed for a ledger
create or replace function public.is_month_closed(p_ledger_id uuid, p_date date)
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.month_closures
    where ledger_id = p_ledger_id
      and year_month = to_char(p_date, 'YYYY-MM')
  );
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
alter table public.profiles                  enable row level security;
alter table public.ledgers                   enable row level security;
alter table public.ledger_members            enable row level security;
alter table public.accounts                  enable row level security;
alter table public.categories                enable row level security;
alter table public.tags                      enable row level security;
alter table public.merchants                 enable row level security;
alter table public.transactions              enable row level security;
alter table public.transaction_splits        enable row level security;
alter table public.transaction_tags          enable row level security;
alter table public.budgets                   enable row level security;
alter table public.budget_alerts             enable row level security;
alter table public.subscriptions             enable row level security;
alter table public.exchange_rates            enable row level security;
alter table public.classification_rules      enable row level security;
alter table public.monthly_summaries         enable row level security;
alter table public.insights                  enable row level security;
alter table public.notifications             enable row level security;
alter table public.reconciliation_snapshots  enable row level security;
alter table public.audit_logs                enable row level security;
alter table public.attachments               enable row level security;
alter table public.ocr_jobs                  enable row level security;
alter table public.export_jobs               enable row level security;
alter table public.month_closures            enable row level security;

-- ============================================================
-- 1. PROFILES
-- ============================================================
-- Users can read their own profile
create policy "profiles_select_own"
  on public.profiles for select
  using (id = auth.uid());

-- Users can update their own profile
create policy "profiles_update_own"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Insert handled by trigger (fn_handle_new_user), but allow self-insert
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (id = auth.uid());

-- ============================================================
-- 2. LEDGERS
-- ============================================================
-- Members can see ledgers they belong to
create policy "ledgers_select_member"
  on public.ledgers for select
  using (public.is_ledger_member(id));

-- Any authenticated user can create a ledger
create policy "ledgers_insert_auth"
  on public.ledgers for insert
  with check (auth.uid() = created_by);

-- Only owner/admin can update ledger details
create policy "ledgers_update_owner_admin"
  on public.ledgers for update
  using (public.is_owner_or_admin(id))
  with check (public.is_owner_or_admin(id));

-- Only owner can delete a ledger
create policy "ledgers_delete_owner"
  on public.ledgers for delete
  using (public.get_ledger_role(id) = 'owner');

-- ============================================================
-- 3. LEDGER_MEMBERS
-- ============================================================
-- Members can see other members of their ledgers
create policy "lm_select_member"
  on public.ledger_members for select
  using (public.is_ledger_member(ledger_id));

-- Owner/admin can add members
create policy "lm_insert_owner_admin"
  on public.ledger_members for insert
  with check (public.is_owner_or_admin(ledger_id));

-- Owner/admin can update member roles
create policy "lm_update_owner_admin"
  on public.ledger_members for update
  using (public.is_owner_or_admin(ledger_id))
  with check (public.is_owner_or_admin(ledger_id));

-- Owner/admin can remove members; users can remove themselves
create policy "lm_delete_owner_admin_or_self"
  on public.ledger_members for delete
  using (
    public.is_owner_or_admin(ledger_id)
    or user_id = auth.uid()
  );

-- ============================================================
-- 4. ACCOUNTS
-- ============================================================
create policy "accounts_select"
  on public.accounts for select
  using (public.is_ledger_member(ledger_id));

create policy "accounts_insert"
  on public.accounts for insert
  with check (public.has_write_access(ledger_id));

create policy "accounts_update"
  on public.accounts for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

create policy "accounts_delete"
  on public.accounts for delete
  using (public.is_owner_or_admin(ledger_id));

-- ============================================================
-- 5. CATEGORIES
-- ============================================================
create policy "categories_select"
  on public.categories for select
  using (public.is_ledger_member(ledger_id));

create policy "categories_insert"
  on public.categories for insert
  with check (public.has_write_access(ledger_id));

create policy "categories_update"
  on public.categories for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

create policy "categories_delete"
  on public.categories for delete
  using (public.is_owner_or_admin(ledger_id));

-- ============================================================
-- 6. TAGS
-- ============================================================
create policy "tags_select"
  on public.tags for select
  using (public.is_ledger_member(ledger_id));

create policy "tags_insert"
  on public.tags for insert
  with check (public.has_write_access(ledger_id));

create policy "tags_update"
  on public.tags for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

create policy "tags_delete"
  on public.tags for delete
  using (public.is_owner_or_admin(ledger_id));

-- ============================================================
-- 7. MERCHANTS
-- ============================================================
create policy "merchants_select"
  on public.merchants for select
  using (public.is_ledger_member(ledger_id));

create policy "merchants_insert"
  on public.merchants for insert
  with check (public.has_write_access(ledger_id));

create policy "merchants_update"
  on public.merchants for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

create policy "merchants_delete"
  on public.merchants for delete
  using (public.is_owner_or_admin(ledger_id));

-- ============================================================
-- 8. TRANSACTIONS
-- Month-closure-aware policies for editors
-- ============================================================
create policy "txn_select"
  on public.transactions for select
  using (public.is_ledger_member(ledger_id));

-- INSERT: editors allowed ONLY in open months; owner/admin always allowed
create policy "txn_insert"
  on public.transactions for insert
  with check (
    public.has_write_access(ledger_id)
    and (
      public.is_owner_or_admin(ledger_id)
      or not public.is_month_closed(ledger_id, date)
    )
  );

-- UPDATE: editors allowed ONLY in open months; owner/admin always allowed
-- Must check both old and new date when month changes
create policy "txn_update"
  on public.transactions for update
  using (
    public.has_write_access(ledger_id)
    and (
      public.is_owner_or_admin(ledger_id)
      or not public.is_month_closed(ledger_id, date)
    )
  )
  with check (
    public.has_write_access(ledger_id)
    and (
      public.is_owner_or_admin(ledger_id)
      or not public.is_month_closed(ledger_id, date)
    )
  );

-- DELETE: editors allowed ONLY in open months; owner/admin always allowed
create policy "txn_delete"
  on public.transactions for delete
  using (
    public.has_write_access(ledger_id)
    and (
      public.is_owner_or_admin(ledger_id)
      or not public.is_month_closed(ledger_id, date)
    )
  );

-- ============================================================
-- 9. TRANSACTION_SPLITS
-- Inherit access from parent transaction's ledger
-- ============================================================
create policy "txn_splits_select"
  on public.transaction_splits for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and public.is_ledger_member(t.ledger_id)
    )
  );

create policy "txn_splits_insert"
  on public.transaction_splits for insert
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and public.has_write_access(t.ledger_id)
        and (
          public.is_owner_or_admin(t.ledger_id)
          or not public.is_month_closed(t.ledger_id, t.date)
        )
    )
  );

create policy "txn_splits_update"
  on public.transaction_splits for update
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and public.has_write_access(t.ledger_id)
        and (
          public.is_owner_or_admin(t.ledger_id)
          or not public.is_month_closed(t.ledger_id, t.date)
        )
    )
  )
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and public.has_write_access(t.ledger_id)
        and (
          public.is_owner_or_admin(t.ledger_id)
          or not public.is_month_closed(t.ledger_id, t.date)
        )
    )
  );

create policy "txn_splits_delete"
  on public.transaction_splits for delete
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id
        and public.has_write_access(t.ledger_id)
        and (
          public.is_owner_or_admin(t.ledger_id)
          or not public.is_month_closed(t.ledger_id, t.date)
        )
    )
  );

-- ============================================================
-- 10. TRANSACTION_TAGS
-- ============================================================
create policy "txn_tags_select"
  on public.transaction_tags for select
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and public.is_ledger_member(t.ledger_id)
    )
  );

create policy "txn_tags_insert"
  on public.transaction_tags for insert
  with check (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and public.has_write_access(t.ledger_id)
    )
  );

create policy "txn_tags_delete"
  on public.transaction_tags for delete
  using (
    exists (
      select 1 from public.transactions t
      where t.id = transaction_id and public.has_write_access(t.ledger_id)
    )
  );

-- ============================================================
-- 11. BUDGETS
-- ============================================================
create policy "budgets_select"
  on public.budgets for select
  using (public.is_ledger_member(ledger_id));

create policy "budgets_insert"
  on public.budgets for insert
  with check (public.has_write_access(ledger_id));

create policy "budgets_update"
  on public.budgets for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

create policy "budgets_delete"
  on public.budgets for delete
  using (public.is_owner_or_admin(ledger_id));

-- ============================================================
-- 12. BUDGET_ALERTS
-- ============================================================
create policy "budget_alerts_select"
  on public.budget_alerts for select
  using (
    exists (
      select 1 from public.budgets b
      where b.id = budget_id and public.is_ledger_member(b.ledger_id)
    )
  );

create policy "budget_alerts_insert"
  on public.budget_alerts for insert
  with check (
    exists (
      select 1 from public.budgets b
      where b.id = budget_id and public.has_write_access(b.ledger_id)
    )
  );

create policy "budget_alerts_update"
  on public.budget_alerts for update
  using (
    exists (
      select 1 from public.budgets b
      where b.id = budget_id and public.has_write_access(b.ledger_id)
    )
  )
  with check (
    exists (
      select 1 from public.budgets b
      where b.id = budget_id and public.has_write_access(b.ledger_id)
    )
  );

create policy "budget_alerts_delete"
  on public.budget_alerts for delete
  using (
    exists (
      select 1 from public.budgets b
      where b.id = budget_id and public.is_owner_or_admin(b.ledger_id)
    )
  );

-- ============================================================
-- 13. SUBSCRIPTIONS
-- ============================================================
create policy "subscriptions_select"
  on public.subscriptions for select
  using (public.is_ledger_member(ledger_id));

create policy "subscriptions_insert"
  on public.subscriptions for insert
  with check (public.has_write_access(ledger_id));

create policy "subscriptions_update"
  on public.subscriptions for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

create policy "subscriptions_delete"
  on public.subscriptions for delete
  using (public.is_owner_or_admin(ledger_id));

-- ============================================================
-- 14. EXCHANGE_RATES (global read; write requires auth)
-- ============================================================
create policy "exchange_rates_select"
  on public.exchange_rates for select
  using (true);

create policy "exchange_rates_insert"
  on public.exchange_rates for insert
  with check (auth.uid() is not null);

create policy "exchange_rates_update"
  on public.exchange_rates for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- ============================================================
-- 15. CLASSIFICATION_RULES
-- ============================================================
create policy "class_rules_select"
  on public.classification_rules for select
  using (public.is_ledger_member(ledger_id));

create policy "class_rules_insert"
  on public.classification_rules for insert
  with check (public.has_write_access(ledger_id));

create policy "class_rules_update"
  on public.classification_rules for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

create policy "class_rules_delete"
  on public.classification_rules for delete
  using (public.is_owner_or_admin(ledger_id));

-- ============================================================
-- 16. MONTHLY_SUMMARIES
-- ============================================================
create policy "monthly_summaries_select"
  on public.monthly_summaries for select
  using (public.is_ledger_member(ledger_id));

-- Summaries are typically computed by edge functions / cron
-- Allow write for owner/admin
create policy "monthly_summaries_insert"
  on public.monthly_summaries for insert
  with check (public.is_owner_or_admin(ledger_id));

create policy "monthly_summaries_update"
  on public.monthly_summaries for update
  using (public.is_owner_or_admin(ledger_id))
  with check (public.is_owner_or_admin(ledger_id));

-- ============================================================
-- 17. INSIGHTS
-- ============================================================
create policy "insights_select"
  on public.insights for select
  using (public.is_ledger_member(ledger_id));

create policy "insights_insert"
  on public.insights for insert
  with check (public.is_owner_or_admin(ledger_id));

create policy "insights_update"
  on public.insights for update
  using (public.is_ledger_member(ledger_id))
  with check (public.is_ledger_member(ledger_id));

-- ============================================================
-- 18. NOTIFICATIONS
-- ============================================================
create policy "notifications_select_own"
  on public.notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notifications_insert"
  on public.notifications for insert
  with check (user_id = auth.uid() or auth.uid() is not null);

create policy "notifications_delete_own"
  on public.notifications for delete
  using (user_id = auth.uid());

-- ============================================================
-- 19. RECONCILIATION_SNAPSHOTS
-- ============================================================
create policy "recon_select"
  on public.reconciliation_snapshots for select
  using (public.is_ledger_member(ledger_id));

create policy "recon_insert"
  on public.reconciliation_snapshots for insert
  with check (public.has_write_access(ledger_id));

create policy "recon_update"
  on public.reconciliation_snapshots for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

-- ============================================================
-- 20. AUDIT_LOGS (read-only for members; insert via trigger only)
-- ============================================================
create policy "audit_logs_select"
  on public.audit_logs for select
  using (public.is_ledger_member(ledger_id));

-- No INSERT/UPDATE/DELETE policies for users — trigger uses SECURITY DEFINER

-- ============================================================
-- 21. ATTACHMENTS
-- ============================================================
create policy "attachments_select"
  on public.attachments for select
  using (public.is_ledger_member(ledger_id));

create policy "attachments_insert"
  on public.attachments for insert
  with check (public.has_write_access(ledger_id) and uploaded_by = auth.uid());

create policy "attachments_update"
  on public.attachments for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

create policy "attachments_delete"
  on public.attachments for delete
  using (
    public.is_owner_or_admin(ledger_id)
    or uploaded_by = auth.uid()
  );

-- ============================================================
-- 22. OCR_JOBS
-- ============================================================
create policy "ocr_jobs_select"
  on public.ocr_jobs for select
  using (public.is_ledger_member(ledger_id));

create policy "ocr_jobs_insert"
  on public.ocr_jobs for insert
  with check (public.has_write_access(ledger_id) and created_by = auth.uid());

create policy "ocr_jobs_update"
  on public.ocr_jobs for update
  using (public.has_write_access(ledger_id))
  with check (public.has_write_access(ledger_id));

-- ============================================================
-- 23. EXPORT_JOBS
-- ============================================================
create policy "export_jobs_select"
  on public.export_jobs for select
  using (public.is_ledger_member(ledger_id));

create policy "export_jobs_insert"
  on public.export_jobs for insert
  with check (public.is_ledger_member(ledger_id) and created_by = auth.uid());

create policy "export_jobs_update"
  on public.export_jobs for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ============================================================
-- 24. MONTH_CLOSURES
-- Only owner/admin can close/reopen months
-- ============================================================
create policy "month_closures_select"
  on public.month_closures for select
  using (public.is_ledger_member(ledger_id));

create policy "month_closures_insert"
  on public.month_closures for insert
  with check (public.is_owner_or_admin(ledger_id));

create policy "month_closures_delete"
  on public.month_closures for delete
  using (public.is_owner_or_admin(ledger_id));

-- ============================================================
-- END 04_rls_policies.sql
-- ============================================================
