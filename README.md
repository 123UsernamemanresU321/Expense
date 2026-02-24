# 💰 FinanceHub — Personal Finance Dashboard

A production-grade, multi-page personal finance dashboard built with Next.js (static export) + Supabase.

## Tech Stack

| Layer | Technology |
|-------|-----------| 
| Frontend | Next.js 16 (App Router, Static Export) |
| Styling | TailwindCSS v4 |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Edge Functions | Supabase Deno Runtime |
| Hosting | GitHub Pages (static) |
| CI/CD | GitHub Actions |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials.

### 3. Set Up Database

Run the SQL files in order in the Supabase Dashboard SQL Editor:

```
supabase/sql/01_enums_tables.sql    → Schema (enums + tables)
supabase/sql/02_indexes.sql         → Performance indexes
supabase/sql/03_triggers.sql        → Triggers (audit, splits, closures)
supabase/sql/04_rls_policies.sql    → Row Level Security
supabase/sql/05_seed.sql            → Demo data
supabase/sql/06_sanity_tests.sql    → Verification queries
supabase/sql/07_import_jobs_table.sql → Import jobs table
```

See [`docs/supabase_manual_setup.md`](./docs/supabase_manual_setup.md) for details.

### 4. Deploy Edge Functions

Copy each function from `supabase/functions/<name>/index.ts` into the Supabase Dashboard Edge Functions editor.

See [`docs/supabase_edge_functions_manual_deploy.md`](./docs/supabase_edge_functions_manual_deploy.md).

### 5. Run Development Server

```bash
npm run dev
```

### 6. Build for Production

```bash
npm run build   # outputs static site to out/
npx serve out   # preview locally
```

## Deploy to GitHub Pages

Full guide: [`docs/github_pages_deploy.md`](./docs/github_pages_deploy.md)

**Quick steps:**
1. Push to `main`
2. Set GitHub Pages source → **GitHub Actions**
3. Add secrets: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_BASE_PATH`
4. The `pages.yml` workflow builds and deploys automatically

## Project Structure

```
src/
├── app/                          # Next.js App Router pages
│   ├── auth/{login,register,reset}/
│   ├── dashboard/
│   ├── transactions/ + transactions/new/
│   ├── categories/
│   ├── accounts/
│   ├── budgets/
│   ├── subscriptions/
│   ├── analytics/
│   ├── shared/
│   ├── settings/
│   └── layout.tsx
├── components/
│   ├── layout/                   # AppShell, Sidebar, Topbar
│   └── ui/                       # Toast, Modal, Button, Input, etc.
├── lib/
│   ├── supabase/client.ts        # Browser Supabase client
│   ├── supabase/edge-functions.ts
│   ├── api/                      # 11 domain API modules
│   ├── auth-context.tsx          # Auth + ledger + role context
│   └── errors.ts                 # Error model + toast
├── types/database.ts             # TypeScript types (24 tables)
supabase/
├── sql/                          # SQL files (01–07)
├── functions/                    # 8 Edge Functions
docs/
├── supabase_manual_setup.md
├── supabase_edge_functions_manual_deploy.md
├── frontend_data_contract.md
├── github_pages_deploy.md
└── ui_notes.md
.github/workflows/
├── pages.yml                     # Build + deploy to GitHub Pages
├── ci.yml                        # TypeScript + build checks
└── cron.yml                      # Nightly edge function calls
```

## Security Model

- Frontend uses only the **anon key** + RLS
- **Service role key** is stored only in Supabase Edge Function secrets
- **Cron secret** is stored only in GitHub Secrets + Supabase Secrets
- All mutations with elevated privileges go through Edge Functions

## Schema Contract

The database schema in `supabase/sql/01-04` is treated as a **contract**:
- Table/column names are frozen after Phase 1
- Changes must be via new SQL migration files
