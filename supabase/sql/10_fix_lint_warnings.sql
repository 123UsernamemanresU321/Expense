-- ============================================================
-- 10_fix_lint_warnings.sql
-- Fixes Supabase linter warnings:
--   1. SECURITY: set search_path on all functions
--   2. PERFORMANCE: wrap auth.uid() in (select ...) in RLS policies
--   3. PERFORMANCE: merge duplicate ledger_members INSERT policies
-- Run in Supabase Dashboard SQL Editor
-- ============================================================

-- ============================================================
-- 1. FIX FUNCTION SEARCH_PATH (Security)
-- ============================================================

-- fn_set_updated_at
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.updated_at := now();
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
  v_parent_amount numeric;
  v_split_total   numeric;
begin
  select amount into v_parent_amount
  from public.transactions where id = new.transaction_id;

  select coalesce(sum(amount), 0) into v_split_total
  from public.transaction_splits where transaction_id = new.transaction_id;

  if v_split_total > v_parent_amount then
    raise exception 'Split total (%) exceeds transaction amount (%)', v_split_total, v_parent_amount;
  end if;
  return new;
end;
$$;

-- fn_enforce_month_closure
create or replace function public.fn_enforce_month_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.month_closures
    where ledger_id = new.ledger_id
      and year_month = to_char(new.date, 'YYYY-MM')
  ) then
    -- Allow owner/admin via RLS; this trigger is a secondary guard for direct SQL
    if not public.is_owner_or_admin(new.ledger_id) then
      raise exception 'Month % is closed for this ledger', to_char(new.date, 'YYYY-MM');
    end if;
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
begin
  select t.ledger_id, t.date into v_ledger_id, v_date
  from public.transactions t where t.id = new.transaction_id;

  if exists (
    select 1 from public.month_closures
    where ledger_id = v_ledger_id
      and year_month = to_char(v_date, 'YYYY-MM')
  ) then
    if not public.is_owner_or_admin(v_ledger_id) then
      raise exception 'Month % is closed for this ledger', to_char(v_date, 'YYYY-MM');
    end if;
  end if;
  return new;
end;
$$;

-- fn_auto_add_ledger_owner
create or replace function public.fn_auto_add_ledger_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ledger_members (ledger_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (ledger_id, user_id) do nothing;
  return new;
end;
$$;

-- fn_audit_log (already updated in 08, now adding search_path)
create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ledger_id  uuid;
  v_record_id  uuid;
  v_before     jsonb;
  v_after      jsonb;
  v_actor      uuid;
  v_row_data   jsonb;
begin
  v_actor := auth.uid();

  if tg_op = 'DELETE' then
    v_record_id := old.id;
    v_before    := to_jsonb(old);
    v_after     := null;
    v_row_data  := v_before;
  elsif tg_op = 'INSERT' then
    v_record_id := new.id;
    v_before    := null;
    v_after     := to_jsonb(new);
    v_row_data  := v_after;
  else
    v_record_id := new.id;
    v_before    := to_jsonb(old);
    v_after     := to_jsonb(new);
    v_row_data  := v_after;
  end if;

  if v_row_data ? 'ledger_id' then
    v_ledger_id := (v_row_data ->> 'ledger_id')::uuid;
  elsif v_row_data ? 'transaction_id' then
    select t.ledger_id into v_ledger_id
    from public.transactions t
    where t.id = (v_row_data ->> 'transaction_id')::uuid;
  elsif v_row_data ? 'budget_id' then
    select b.ledger_id into v_ledger_id
    from public.budgets b
    where b.id = (v_row_data ->> 'budget_id')::uuid;
  elsif v_row_data ? 'account_id' then
    select a.ledger_id into v_ledger_id
    from public.accounts a
    where a.id = (v_row_data ->> 'account_id')::uuid;
  end if;

  insert into public.audit_logs (ledger_id, table_name, record_id, action, actor_id, before_data, after_data)
  values (v_ledger_id, tg_table_name, v_record_id, tg_op, v_actor, v_before, v_after);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- RLS helper functions: add search_path
create or replace function public.is_ledger_member(p_ledger_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id and user_id = (select auth.uid())
  );
$$;

create or replace function public.get_ledger_role(p_ledger_id uuid)
returns public.ledger_role
language sql
security definer
stable
set search_path = ''
as $$
  select role from public.ledger_members
  where ledger_id = p_ledger_id and user_id = (select auth.uid());
$$;

create or replace function public.has_write_access(p_ledger_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin', 'editor')
  );
$$;

create or replace function public.is_owner_or_admin(p_ledger_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
  );
$$;

create or replace function public.is_month_closed(p_ledger_id uuid, p_date date)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.month_closures
    where ledger_id = p_ledger_id
      and year_month = to_char(p_date, 'YYYY-MM')
  );
$$;

-- ============================================================
-- 2. FIX RLS INITPLAN (Performance)
--    Replace auth.uid() with (select auth.uid()) in policies
-- ============================================================

-- profiles
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select
  using (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles for update
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles for insert
  with check (id = (select auth.uid()));

-- ledgers
drop policy if exists "ledgers_insert_auth" on public.ledgers;
create policy "ledgers_insert_auth" on public.ledgers for insert
  with check ((select auth.uid()) = created_by);

-- ledger_members: merge two INSERT policies into one
drop policy if exists "lm_insert_creator" on public.ledger_members;
drop policy if exists "lm_insert_owner_admin" on public.ledger_members;
create policy "lm_insert_allowed" on public.ledger_members for insert
  with check (
    -- Owner/admin can add anyone
    public.is_owner_or_admin(ledger_id)
    -- OR: creator can add themselves
    or (
      user_id = (select auth.uid())
      and exists (
        select 1 from public.ledgers
        where id = ledger_id and created_by = (select auth.uid())
      )
    )
  );

drop policy if exists "lm_delete_owner_admin_or_self" on public.ledger_members;
create policy "lm_delete_owner_admin_or_self" on public.ledger_members for delete
  using (
    public.is_owner_or_admin(ledger_id)
    or user_id = (select auth.uid())
  );

-- exchange_rates
drop policy if exists "exchange_rates_insert" on public.exchange_rates;
create policy "exchange_rates_insert" on public.exchange_rates for insert
  with check ((select auth.uid()) is not null);

drop policy if exists "exchange_rates_update" on public.exchange_rates;
create policy "exchange_rates_update" on public.exchange_rates for update
  using ((select auth.uid()) is not null)
  with check ((select auth.uid()) is not null);

-- notifications
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select
  using (user_id = (select auth.uid()));

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications for insert
  with check (user_id = (select auth.uid()) or (select auth.uid()) is not null);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications for delete
  using (user_id = (select auth.uid()));

-- attachments
drop policy if exists "attachments_insert" on public.attachments;
create policy "attachments_insert" on public.attachments for insert
  with check (public.has_write_access(ledger_id) and uploaded_by = (select auth.uid()));

drop policy if exists "attachments_delete" on public.attachments;
create policy "attachments_delete" on public.attachments for delete
  using (
    public.is_owner_or_admin(ledger_id)
    or uploaded_by = (select auth.uid())
  );

-- ocr_jobs
drop policy if exists "ocr_jobs_insert" on public.ocr_jobs;
create policy "ocr_jobs_insert" on public.ocr_jobs for insert
  with check (public.has_write_access(ledger_id) and created_by = (select auth.uid()));

-- export_jobs
drop policy if exists "export_jobs_insert" on public.export_jobs;
create policy "export_jobs_insert" on public.export_jobs for insert
  with check (public.is_ledger_member(ledger_id) and created_by = (select auth.uid()));

drop policy if exists "export_jobs_update" on public.export_jobs;
create policy "export_jobs_update" on public.export_jobs for update
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

-- import_jobs
drop policy if exists "import_jobs_insert" on public.import_jobs;
create policy "import_jobs_insert" on public.import_jobs for insert
  with check (public.has_write_access(ledger_id) and created_by = (select auth.uid()));

drop policy if exists "import_jobs_update" on public.import_jobs;
create policy "import_jobs_update" on public.import_jobs for update
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));
