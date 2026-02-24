-- ============================================================
-- 09_fix_ledger_member_self_insert.sql
-- Fix: Allow a ledger creator to add themselves as the first member.
-- The existing lm_insert_owner_admin policy requires is_owner_or_admin,
-- but that check fails on the very first insert (no members yet).
-- ============================================================

-- Allow a user to insert themselves as a member if they created the ledger
create policy "lm_insert_creator"
  on public.ledger_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.ledgers
      where id = ledger_id and created_by = auth.uid()
    )
  );
