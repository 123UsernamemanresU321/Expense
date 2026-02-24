-- Fix missing is_active columns in categories and ledgers, and reload schema cache

-- 1. categories is missing is_active (frontend expects it for soft deletion and filtering)
alter table public.categories add column if not exists is_active boolean not null default true;

-- 2. ledgers was created with is_archived, but frontend expects is_active
-- Rename column and invert the logic so default is true
alter table public.ledgers rename column is_archived to is_active;
alter table public.ledgers alter column is_active set default true;

-- Update existing active ledgers (is_archived was false, so we flip it. wait, if we rename it, false becomes false, which means it became inactive!)
update public.ledgers set is_active = not is_active;

-- Force PostgREST schema cache to reload so the new columns are recognized
NOTIFY pgrst, 'reload schema';
