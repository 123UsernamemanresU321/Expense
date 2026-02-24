# 💰 Personal Finance Dashboard

A production-grade, multi-page personal finance dashboard built with Next.js (static export) + Supabase.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router, Static Export) |
| UI | TailwindCSS + shadcn/ui |
| Database | Supabase (PostgreSQL + RLS) |
| Auth | Supabase Auth |
| Hosting | GitHub Pages (static) |

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Supabase credentials (see [Supabase Manual Setup](./docs/supabase_manual_setup.md)).

### 3. Set Up Database

Run the SQL files in order in the Supabase Dashboard SQL Editor:

```
supabase/sql/01_enums_tables.sql    → Schema (enums + tables)
supabase/sql/02_indexes.sql         → Performance indexes
supabase/sql/03_triggers.sql        → Triggers (audit, splits, closures)
supabase/sql/04_rls_policies.sql    → Row Level Security
supabase/sql/05_seed.sql            → Demo data
supabase/sql/06_sanity_tests.sql    → Verification queries
```

See [`docs/supabase_manual_setup.md`](./docs/supabase_manual_setup.md) for detailed instructions.

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Build for Production (Static Export)

```bash
npm run build
```

This produces a static site in the `out/` directory.

### 6. Preview Production Build

```bash
npx serve out
```

## GitHub Pages Deployment

This app is configured for static export to GitHub Pages.

### Base Path Configuration

If your repository is at `github.com/username/Expense`, set in `.env.local`:

```
NEXT_PUBLIC_BASE_PATH=/Expense
```

For custom domains (no subpath), leave it empty:

```
NEXT_PUBLIC_BASE_PATH=
```

### GitHub Actions

The CI/CD workflow (`.github/workflows/deploy.yml`) will be added in Phase 5. For now, you can deploy manually:

```bash
npm run build
# Push the `out/` directory to the `gh-pages` branch
```

## Project Structure

```
├── app/                        # Next.js App Router pages
│   ├── auth/
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── reset/page.tsx
│   ├── dashboard/page.tsx
│   ├── transactions/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── src/
│   ├── components/             # React components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── layout/             # App shell (sidebar, topbar)
│   │   └── auth/               # Auth forms
│   └── lib/
│       ├── supabase.ts         # Supabase client (browser)
│       └── database.types.ts   # TypeScript types (matches DB)
├── supabase/
│   ├── sql/                    # SQL files (run in Supabase Dashboard)
│   └── functions/              # Edge functions (Phase 2)
├── docs/                       # Setup guides
├── .github/workflows/          # CI/CD (Phase 5)
└── public/                     # Static assets
```

## Schema Contract

The database schema in `supabase/sql/01-04` is treated as a **contract**:
- Table/column names are frozen after Phase 1
- Changes must be via new SQL migration files (e.g., `07_migration_*.sql`)
- Never edit existing SQL files (01–04)
