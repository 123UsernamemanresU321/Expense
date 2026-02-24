# Supabase Edge Functions

8 production-ready Edge Functions for the Personal Finance Dashboard.

| Function | Purpose |
|----------|---------|
| `aggregate-monthly-summaries` | Upsert monthly income/expense (transfers excluded) |
| `generate-insights` | Deterministic financial insights (5 rules) |
| `generate-subscription-instances` | Create future transactions from subscriptions |
| `apply-classification-rules` | Test/apply auto-categorization (SQL LIKE patterns) |
| `import-job-runner` | CSV import with auto-mapping + deduplication |
| `generate-export-pack` | Export CSV/JSON pack to Storage with signed URLs |
| `reconcile-snapshot-helper` | Account reconciliation snapshots |
| `ocr-job-worker` | Placeholder OCR pipeline (swap in real provider) |

## Shared Helpers (`_shared/`)

| File | Purpose |
|------|---------|
| `cors.ts` | CORS headers |
| `supabase-admin.ts` | Service role + user client factories |
| `auth.ts` | JWT validation, membership/role checks, cron secret |
| `response.ts` | JSON response helpers + error wrapper |

## Deploy Guide

See [`/docs/supabase_edge_functions_manual_deploy.md`](../docs/supabase_edge_functions_manual_deploy.md).
