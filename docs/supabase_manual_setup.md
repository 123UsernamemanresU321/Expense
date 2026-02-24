# Supabase Manual Setup Guide

Step-by-step guide to set up the database schema using the Supabase Dashboard SQL Editor.

## Prerequisites

1. **Supabase project** created at [supabase.com](https://supabase.com)
2. Access to the **SQL Editor** in the Supabase Dashboard
3. **Two test users** created in Authentication → Users (for seed data)

## Step 1: Run Schema (Enums + Tables)

1. Open **Supabase Dashboard** → **SQL Editor**
2. Click **New query**
3. Copy/paste the entire contents of [`01_enums_tables.sql`](../supabase/sql/01_enums_tables.sql)
4. Click **Run** (Ctrl+Enter / Cmd+Enter)
5. Verify: No errors. You should see "Success. No rows returned." for each statement.

> [!IMPORTANT]
> If you see errors about `auth.users` not existing, ensure you're running this in the default Supabase project (which includes the `auth` schema automatically).

## Step 2: Create Indexes

1. Click **New query** (or clear the editor)
2. Copy/paste the entire contents of [`02_indexes.sql`](../supabase/sql/02_indexes.sql)
3. Click **Run**
4. Verify: "Success. No rows returned."

## Step 3: Create Triggers

1. Click **New query**
2. Copy/paste the entire contents of [`03_triggers.sql`](../supabase/sql/03_triggers.sql)
3. Click **Run**
4. Verify: "Success. No rows returned."

> [!NOTE]
> This creates the auth signup trigger, audit logging, split validation, and month closure enforcement triggers.

## Step 4: Enable RLS + Create Policies

1. Click **New query**
2. Copy/paste the entire contents of [`04_rls_policies.sql`](../supabase/sql/04_rls_policies.sql)
3. Click **Run**
4. Verify: "Success. No rows returned."

> [!CAUTION]
> RLS is now active on ALL tables. Without valid auth credentials, no data will be readable. This is by design.

## Step 5: Insert Seed Data

1. **Create two test users** in Dashboard → Authentication → Users
   - User A: `alice@example.com` (will be ledger owner)
   - User B: `bob@example.com` (will be ledger editor)
2. Copy their UUIDs from the Users table
3. Open [`05_seed.sql`](../supabase/sql/05_seed.sql) and replace the two placeholder UUIDs:
   ```sql
   v_user_a uuid := '00000000-0000-0000-0000-000000000001'; -- REPLACE ME
   v_user_b uuid := '00000000-0000-0000-0000-000000000002'; -- REPLACE ME
   ```
4. Copy/paste the modified seed SQL into a **New query**
5. Click **Run**
6. Verify: Check the `NOTICE` message for the created Ledger ID

## Step 6: Run Sanity Tests

1. Click **New query**
2. Copy/paste [`06_sanity_tests.sql`](../supabase/sql/06_sanity_tests.sql)
3. Click **Run**
4. Review each test result:
   - **Test 1** — Membership visibility: should show "Household Budget" with 3 accounts
   - **Test 2** — Viewer write check: `can_write = false`
   - **Test 3** — Open month: January is the only closed month
   - **Test 4** — Closed month check: `jan_closed = true`, `feb_closed = false`
   - **Test 5** — Owner/admin check: role = owner
   - **Test 6** — Refund linkage: 1 row, $45 refund → original
   - **Test 7** — Split validation: ✅ BALANCED ($55 + $30 = $85)
   - **Test 8** — Transfer exclusion: transfers separated from income/expense
   - **Test 9** — Monthly aggregation: computed matches stored

> [!TIP]
> Some RLS-dependent tests (Tests 2–5) require you to be logged in as the relevant user. You can test these from the frontend or by using `set request.jwt.claim.sub = '<user_uuid>';` before running the queries.

## Getting Your API Keys

After setup, get your keys from **Settings → API**:

| Key | Usage |
|-----|-------|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` |
| **anon/public key** | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |

> [!WARNING]
> Never use the `service_role` key in the frontend. All frontend access goes through RLS with the anon key.

## Schema Migration Policy

After this initial setup, the schema is treated as a **contract**:

- **Never** edit the existing SQL files (01–04)
- To make schema changes, create a new SQL file: `07_migration_<description>.sql`
- Number migrations sequentially
- Document the change in a `CHANGELOG.md`
