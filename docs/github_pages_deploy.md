# GitHub Pages Deployment Guide

## Prerequisites

- A GitHub repository with this code pushed to the `main` branch
- A Supabase project with the schema deployed (Phase 1)
- Edge Functions deployed via the Supabase Dashboard (Phase 2)

## 1. Configure GitHub Pages Source

1. Go to **Settings → Pages**
2. Under **Build and deployment**, set **Source** to **GitHub Actions**
3. No need to select a branch — the `pages.yml` workflow handles everything

## 2. Add GitHub Repository Secrets

Go to **Settings → Secrets and variables → Actions → New repository secret**:

### Required (for build)

| Secret Name | Value | Example |
|-------------|-------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | `https://abcdef.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key | `eyJhbG...` |
| `NEXT_PUBLIC_BASE_PATH` | Repo name with leading `/` | `/Expense` |

### Optional (for nightly cron)

| Secret Name | Value | Example |
|-------------|-------|---------|
| `SUPABASE_EDGE_BASE_URL` | Edge Functions base URL | `https://abcdef.supabase.co/functions/v1` |
| `SUPABASE_CRON_SECRET` | Shared secret (must match `X_CRON_SECRET` in Supabase Function secrets) | `my-secret-key-123` |

## 3. Base Path Setup

The `next.config.ts` reads `NEXT_PUBLIC_BASE_PATH` at build time:

```ts
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
// → basePath: "/Expense", assetPrefix: "/Expense"
```

This is injected as a GitHub Secret so all asset URLs are prefixed correctly.

**Important**: If your repo is named `username.github.io`, set `NEXT_PUBLIC_BASE_PATH` to empty string `""`.

## 4. How Environment Variables Are Injected

The `pages.yml` workflow passes secrets as `env:` to the `npm run build` step:

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
  NEXT_PUBLIC_BASE_PATH: ${{ secrets.NEXT_PUBLIC_BASE_PATH }}
```

Next.js inlines `NEXT_PUBLIC_*` vars into the static bundle at build time. No `.env` file is needed in the repo for production.

## 5. Deploy

Push to `main` → the `pages.yml` workflow runs automatically:

1. `npm ci` — installs dependencies
2. `npm run build` — generates static export to `out/`
3. `upload-pages-artifact` — uploads the `out/` directory
4. `deploy-pages` — publishes to GitHub Pages

Your site will be live at:
```
https://<username>.github.io/<repo-name>/
```

## 6. CI Workflow

The `ci.yml` workflow runs on every push and PR:
- TypeScript type checking (`tsc --noEmit`)
- Full build verification

## 7. Nightly Cron (Optional)

The `cron.yml` workflow runs at **02:00 UTC daily** and calls:

| Edge Function | Purpose |
|---------------|---------|
| `aggregate-monthly-summaries` | Recompute current + previous month totals |
| `generate-insights` | Generate new financial insights |
| `generate-subscription-instances` | Create upcoming subscription transactions |

All calls use the `x-cron-secret` header. Each function validates this against the `X_CRON_SECRET` stored in Supabase Edge Function secrets.

**All calls are idempotent** — safe to re-run.

To trigger manually: go to **Actions → Nightly Edge Function Cron → Run workflow**.

## 8. Troubleshooting

| Issue | Fix |
|-------|-----|
| Blank page after deploy | Check `NEXT_PUBLIC_BASE_PATH` matches your repo name exactly (e.g., `/Expense`) |
| Auth not working | Verify `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correct |
| 404 on page refresh | Expected behavior for static SPA — all routes load via `index.html`. Add a `404.html` that redirects to `index.html` if needed |
| Cron calls failing | Check `SUPABASE_EDGE_BASE_URL` format and ensure `SUPABASE_CRON_SECRET` matches `X_CRON_SECRET` in Supabase |

## 9. Security Checklist

- ✅ Only `NEXT_PUBLIC_*` values are in the static bundle (safe — these are the anon key)
- ✅ `SUPABASE_CRON_SECRET` is only in GitHub Secrets and Supabase Function secrets
- ✅ Service role key is NEVER in the repo or static bundle
- ✅ All privileged operations go through Edge Functions with JWT/role checks
