# Supabase Edge Functions — Manual Deploy Guide

Deploy Edge Functions via the Supabase Dashboard since we are not using the Supabase CLI.

## Prerequisites

1. **Supabase Dashboard** access to your project
2. **Service role key** from Settings → API (never expose this in frontend)
3. Run `07_import_jobs_table.sql` in the SQL Editor first (adds `import_jobs` table)
4. Create Storage buckets: `imports` and `exports` (Dashboard → Storage → New Bucket)

## Function Secrets Setup

Go to **Dashboard → Edge Functions → Secrets** and add:

| Secret Name | Value | Notes |
|---|---|---|
| `SUPABASE_URL` | `https://your-project-id.supabase.co` | Usually auto-set |
| `SUPABASE_ANON_KEY` | Your anon key | Usually auto-set |
| `SUPABASE_SERVICE_ROLE_KEY` | Your service role key | From Settings → API |
| `X_CRON_SECRET` | Random string (e.g. `openssl rand -hex 32`) | For scheduled calls |

> [!CAUTION]
> The service role key bypasses RLS entirely. Only store it in Edge Function secrets — NEVER in frontend code or GitHub.

## Deploying Each Function

Each function in `/supabase/functions/<name>/index.ts` is **fully self-contained** — no external imports other than `@supabase/supabase-js` from esm.sh.

For each function:

1. Go to **Dashboard → Edge Functions → Create New Function**
2. Set the function name exactly as shown below (e.g. `aggregate-monthly-summaries`)
3. Open the matching `index.ts` file from this repo and **copy the entire contents**
4. Paste into the Dashboard code editor
5. Click **Deploy**

> [!TIP]
> The `_shared/` directory is kept in the repo for reference, but is NOT used at runtime. All helpers are inlined into each function.

---

## Function Reference

### 1. `aggregate-monthly-summaries`

**Source:** `supabase/functions/aggregate-monthly-summaries/index.ts`

**Purpose:** Computes monthly income/expense/transfer totals. Transfers excluded from income/expense. Upserts into `monthly_summaries`.

**Request:**
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/aggregate-monthly-summaries' \
  -H 'Authorization: Bearer <user_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"ledger_id": "<uuid>", "month": "2026-02", "backfill_months": 3}'
```

**Response:** `{ success, months_processed, summaries: [{ year_month, total_income, total_expense, ... }] }`

---

### 2. `generate-insights`

**Source:** `supabase/functions/generate-insights/index.ts`

**Purpose:** Generates deterministic financial insights (no LLM). Rules: MoM category spikes, savings, subscription creep, top merchant changes, missing income.

**Request:**
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/generate-insights' \
  -H 'Authorization: Bearer <user_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"ledger_id": "<uuid>", "month": "2026-02"}'
```

**Response:** `{ success, month, insights_generated, insights: [{ title, type }] }`

---

### 3. `generate-subscription-instances`

**Source:** `supabase/functions/generate-subscription-instances/index.ts`

**Purpose:** Creates future expense transactions from active subscriptions. Deduplicates by description + date.

**Request:**
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/generate-subscription-instances' \
  -H 'Authorization: Bearer <user_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"ledger_id": "<uuid>", "horizon_days": 45}'
```

**Response:** `{ success, subscriptions_processed, transactions_created, transactions_skipped }`

---

### 4. `apply-classification-rules`

**Source:** `supabase/functions/apply-classification-rules/index.ts`

**Purpose:** Applies classification rules to categorize/tag transactions. Two modes: `test` (preview) and `apply` (write).

**Test mode:**
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/apply-classification-rules' \
  -H 'Authorization: Bearer <user_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"ledger_id": "<uuid>", "mode": "test", "lookback_days": 30}'
```

**Apply mode:**
```bash
curl -X POST '...' -d '{"ledger_id": "<uuid>", "mode": "apply", "lookback_days": 30}'
```

**Response:** `{ success, mode, total_transactions, matched, applied, rules_evaluated }`

---

### 5. `import-job-runner`

**Source:** `supabase/functions/import-job-runner/index.ts`

**Purpose:** Processes a CSV import job. Downloads CSV from Storage, auto-maps columns, deduplicates, creates transactions.

**Workflow:**
1. Upload CSV to `imports` Storage bucket
2. Create an `import_jobs` row with `storage_path` set
3. Call this function with the `import_job_id`

**Request:**
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/import-job-runner' \
  -H 'Authorization: Bearer <user_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"import_job_id": "<uuid>"}'
```

**Response:** `{ success, total_rows, imported, skipped, errors }`

---

### 6. `generate-export-pack`

**Source:** `supabase/functions/generate-export-pack/index.ts`

**Purpose:** Exports `transactions.csv`, `budgets.csv`, `categories.json`, `summary.json` to Storage. Returns signed download URL.

**Request:**
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/generate-export-pack' \
  -H 'Authorization: Bearer <user_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"ledger_id": "<uuid>", "format": "csv", "filters": {"start_date": "2026-01-01"}}'
```

**Response:** `{ success, job_id, signed_url, files: [...] }`

---

### 7. `reconcile-snapshot-helper`

**Source:** `supabase/functions/reconcile-snapshot-helper/index.ts`

**Purpose:** Computes balance from transactions, compares against bank statement. Creates reconciliation snapshot. Auto-marks transactions as reconciled if balanced.

**Request:**
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/reconcile-snapshot-helper' \
  -H 'Authorization: Bearer <user_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"ledger_id":"<uuid>","account_id":"<uuid>","snapshot_date":"2026-02-28","statement_balance":5000.00}'
```

**Response:** `{ success, computed_balance, statement_balance, difference, is_reconciled }`

---

### 8. `ocr-job-worker`

**Source:** `supabase/functions/ocr-job-worker/index.ts`

**Purpose:** Placeholder OCR pipeline. Transitions `ocr_jobs` through `pending → processing → completed`. Generates mock parsed receipt data. Swap in a real OCR provider later.

**Workflow:**
1. Upload receipt to `attachments` Storage bucket
2. Create `attachments` + `ocr_jobs` rows
3. Call this function

**Request:**
```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/ocr-job-worker' \
  -H 'Authorization: Bearer <user_jwt>' \
  -H 'Content-Type: application/json' \
  -d '{"ocr_job_id": "<uuid>"}'
```

**Response:** `{ success, status, raw_text, parsed_data }`

---

## Cron/Scheduled Calls

For functions you want to run on a schedule (e.g. daily insights, subscription generation), use the `X_CRON_SECRET` header instead of a user JWT. See the `requireCronSecret()` helper in `_shared/auth.ts`.

```bash
curl -X POST 'https://<project>.supabase.co/functions/v1/generate-insights' \
  -H 'x-cron-secret: <your_cron_secret>' \
  -H 'Content-Type: application/json' \
  -d '{"ledger_id": "<uuid>", "month": "2026-02"}'
```

Store `X_CRON_SECRET` in:
- **Supabase:** Edge Functions → Secrets
- **GitHub:** Repository → Settings → Secrets (for future CI/CD cron triggers)

## Storage Buckets Required

Create these in **Dashboard → Storage → New Bucket**:

| Bucket | Purpose | Public? |
|--------|---------|---------|
| `imports` | CSV upload staging | No |
| `exports` | Generated export packs | No |
| `attachments` | Receipt images for OCR | No |
