# Frontend Data Contract

How the frontend interacts with the database and Edge Functions.

## Direct RLS Queries (via Supabase client + anon key)

These tables are read/written directly — RLS ensures visibility:

| Table | Read | Write | Notes |
|-------|------|-------|-------|
| `ledgers` | ✅ | ✅ owner | Via `is_ledger_member()` |
| `ledger_members` | ✅ | ✅ owner/admin | Own membership visible |
| `accounts` | ✅ | ✅ writer+ | Filtered by ledger |
| `categories` | ✅ | ✅ writer+ | Tree structure |
| `tags` | ✅ | ✅ writer+ | — |
| `merchants` | ✅ | ✅ writer+ | — |
| `transactions` | ✅ | ✅ writer+ | Month closure enforced |
| `transaction_splits` | ✅ | ✅ writer+ | — |
| `transaction_tags` | ✅ | ✅ writer+ | — |
| `budgets` | ✅ | ✅ writer+ | — |
| `budget_alerts` | ✅ | ✅ writer+ | — |
| `subscriptions` | ✅ | ✅ writer+ | — |
| `classification_rules` | ✅ | ✅ writer+ | — |
| `monthly_summaries` | ✅ | ❌ | Written by Edge Function |
| `month_closures` | ✅ | ✅ owner/admin | Close/reopen |
| `insights` | ✅ | ❌ | Written by Edge Function |
| `notifications` | ✅ | ✅ own | User's own only |
| `export_jobs` | ✅ | ❌ | Created by Edge Function |
| `import_jobs` | ✅ | ✅ | Created by frontend |
| `reconciliation_snapshots` | ✅ | ❌ | Written by Edge Function |
| `audit_logs` | ✅ viewer+ | ❌ | Read-only via RLS |
| `attachments` | ✅ | ✅ writer+ | — |
| `ocr_jobs` | ✅ | ❌ | Written by Edge Function |
| `exchange_rates` | ✅ | ❌ | Read-only reference |

## Edge Function Operations

These operations require the Edge Function layer (uses service role key internally):

| Function | Trigger | Purpose |
|----------|---------|---------|
| `aggregate-monthly-summaries` | User action / cron | Compute & upsert monthly totals |
| `generate-insights` | User action / cron | Generate deterministic insights |
| `generate-subscription-instances` | User action / cron | Create future transactions |
| `apply-classification-rules` | User action | Test/apply auto-categorization |
| `import-job-runner` | After CSV upload | Process import job |
| `generate-export-pack` | User action | Generate export files |
| `reconcile-snapshot-helper` | User action | Create reconciliation snapshot |
| `ocr-job-worker` | After receipt upload | Process OCR job |

## Required Environment Variables (Public Only)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_BASE_PATH=/Expense  # for GitHub Pages
```

No service role key is ever used in the frontend bundle.
