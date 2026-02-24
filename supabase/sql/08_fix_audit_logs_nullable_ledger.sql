-- ============================================================
-- 08_fix_audit_logs_nullable_ledger.sql
-- Fix: allow audit_logs.ledger_id to be NULL for tables
-- where ledger_id cannot always be resolved by the trigger
-- ============================================================

-- Make ledger_id nullable (was NOT NULL in 01_enums_tables.sql)
alter table public.audit_logs
  alter column ledger_id drop not null;

-- Drop the existing foreign key constraint so null values are allowed
-- (The FK itself already allows nulls once NOT NULL is dropped)

-- Also update the trigger to handle more table shapes:
-- Add lookback for tables that have a ledger_id indirectly
create or replace function public.fn_audit_log()
returns trigger
language plpgsql
security definer
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

  -- Extract ledger_id: direct column first
  if v_row_data ? 'ledger_id' then
    v_ledger_id := (v_row_data ->> 'ledger_id')::uuid;
  -- Fallback: look up via parent FK
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

  -- v_ledger_id may still be null — that's okay now
  insert into public.audit_logs (ledger_id, table_name, record_id, action, actor_id, before_data, after_data)
  values (v_ledger_id, tg_table_name, v_record_id, tg_op, v_actor, v_before, v_after);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
