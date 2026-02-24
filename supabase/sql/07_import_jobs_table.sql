-- ============================================================
-- 07_import_jobs_table.sql
-- Adds the import_jobs table for CSV import pipeline
-- Run in Supabase Dashboard SQL Editor AFTER 01-06
-- ============================================================

create type public.import_status as enum (
  'pending',
  'mapping',
  'processing',
  'completed',
  'failed'
);

create table public.import_jobs (
  id              uuid primary key default gen_random_uuid(),
  ledger_id       uuid not null references public.ledgers(id) on delete cascade,
  storage_path    text not null,
  file_name       text not null,
  status          public.import_status not null default 'pending',
  column_mapping  jsonb,        -- { csv_col: db_col } mapping
  total_rows      int default 0,
  imported_rows   int default 0,
  skipped_rows    int default 0,
  error_rows      int default 0,
  errors          jsonb,        -- [{ row: N, error: "..." }]
  created_by      uuid not null references auth.users(id) on delete restrict,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
comment on table public.import_jobs is 'CSV import pipeline jobs';

-- Indexes
create index idx_import_jobs_ledger on public.import_jobs (ledger_id);
create index idx_import_jobs_status on public.import_jobs (status) where status in ('pending', 'processing');

-- Updated_at trigger
create trigger trg_import_jobs_updated_at
  before update on public.import_jobs
  for each row execute function public.fn_set_updated_at();

-- RLS
alter table public.import_jobs enable row level security;

create policy "import_jobs_select"
  on public.import_jobs for select
  using (public.is_ledger_member(ledger_id));

create policy "import_jobs_insert"
  on public.import_jobs for insert
  with check (public.has_write_access(ledger_id) and created_by = auth.uid());

create policy "import_jobs_update"
  on public.import_jobs for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

-- ============================================================
-- END 07_import_jobs_table.sql
-- ============================================================
