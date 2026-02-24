# UI Notes

## Route Map

| Route | Page | Guard |
|-------|------|-------|
| `/` | Landing page | Public |
| `/auth/login` | Login | Public |
| `/auth/register` | Register | Public |
| `/auth/reset` | Password reset | Public |
| `/dashboard` | Overview (stats, recent txns, budgets, accounts) | Auth |
| `/transactions` | Paginated table with filters | Auth |
| `/transactions/new` | Create transaction form | Auth + Writer |
| `/categories` | Category tree with create/toggle | Auth |
| `/accounts` | Account cards with create/reconcile | Auth |
| `/budgets` | Budget progress cards with create | Auth |
| `/subscriptions` | Subscription table with generate instances | Auth |
| `/analytics` | Net worth, monthly trend, insights feed | Auth |
| `/shared` | Ledger members + monthly close/reopen | Auth |
| `/settings` | Profile + 6 tabs (rules, export, import, audit, OCR, notifications) | Auth |

## Component Responsibilities

| Component | Location | Purpose |
|-----------|----------|---------|
| `AppShell` | `components/layout/app-shell.tsx` | Sidebar + Topbar + RequireAuth guard |
| `Sidebar` | `components/layout/sidebar.tsx` | 9-item nav, collapsible |
| `Topbar` | `components/layout/topbar.tsx` | Ledger name, user email, sign out |
| `ToastContainer` | `components/ui/toast.tsx` | Listens for `app:toast` custom events |
| `EmptyState` | `components/ui/empty-state.tsx` | Empty state placeholder |
| `Skeleton` | `components/ui/empty-state.tsx` | Loading skeleton |
| `Modal` | `components/ui/modal.tsx` | Dialog wrapper |
| `Button` | `components/ui/modal.tsx` | 4 variants: primary, secondary, danger, ghost |
| `Input/Select` | `components/ui/modal.tsx` | Styled form fields |
| `Badge` | `components/ui/modal.tsx` | Status badges with 6 color options |

## Data Fetching Strategy

- All data fetched **client-side** on mount via `useEffect`
- No SSR/SSG data fetching (static export)
- RLS queries use the Supabase JS client with the user's JWT
- Edge Functions called via `callEdgeFunction()` with auto-injected JWT
- Error handling via `safe()` / `unwrap()` wrappers with toast notifications
- Debounced search (350ms) in Transactions
- Pagination via offset-based queries (25/page)
- Job polling for exports/imports with 2s interval, 60s timeout
