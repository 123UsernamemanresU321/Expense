-- ============================================================
-- 16_fix_ledger_members_fk.sql
-- Fixes the 400 Bad Request when querying ledger_members from the dashboard.
-- PostgREST cannot perform joins to views/tables via auth.users references.
-- We must explicitly reference public.profiles(id) so the `.select("*, profile:profiles(...)")` join works.
-- ============================================================

alter table public.ledger_members
  drop constraint if exists ledger_members_user_id_fkey,
  add constraint ledger_members_user_id_fkey foreign key (user_id) references public.profiles(id) on delete cascade;

-- Force PostgREST schema cache to reload
NOTIFY pgrst, 'reload schema';
