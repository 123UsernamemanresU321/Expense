// ============================================================
// database.types.ts
// TypeScript types matching the Supabase DB schema contract
// Auto-generate with: npx supabase gen types typescript --project-id <id>
// This manual version serves as the schema contract reference.
// ============================================================

// ============================================================
// ENUMS
// ============================================================

export type LedgerRole = "owner" | "admin" | "editor" | "viewer";
export type TxnType = "income" | "expense" | "transfer" | "refund" | "adjustment";
export type AccountType = "checking" | "savings" | "credit_card" | "cash" | "investment" | "loan" | "other";
export type BudgetPeriod = "weekly" | "monthly" | "quarterly" | "yearly";
export type SubscriptionInterval = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type NotificationType = "budget_warning" | "budget_exceeded" | "subscription_due" | "month_closed" | "member_added" | "insight" | "system";
export type ExportFormat = "csv" | "xlsx" | "pdf" | "json";
export type OcrStatus = "pending" | "processing" | "completed" | "failed";

// ============================================================
// ROW TYPES
// ============================================================

export interface Profile {
    id: string;
    email: string;
    display_name: string | null;
    avatar_url: string | null;
    currency_code: string;
    locale: string;
    timezone: string;
    created_at: string;
    updated_at: string;
}

export interface Ledger {
    id: string;
    name: string;
    description: string | null;
    currency_code: string;
    created_by: string;
    is_archived: boolean;
    created_at: string;
    updated_at: string;
}

export interface LedgerMember {
    id: string;
    ledger_id: string;
    user_id: string;
    role: LedgerRole;
    invited_by: string | null;
    joined_at: string;
    created_at: string;
    updated_at: string;
}

export interface Account {
    id: string;
    ledger_id: string;
    name: string;
    account_type: AccountType;
    currency_code: string;
    balance: number;
    is_active: boolean;
    institution: string | null;
    note: string | null;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface Category {
    id: string;
    ledger_id: string;
    parent_id: string | null;
    name: string;
    icon: string | null;
    color: string | null;
    is_income: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface Tag {
    id: string;
    ledger_id: string;
    name: string;
    color: string | null;
    created_at: string;
    updated_at: string;
}

export interface Merchant {
    id: string;
    ledger_id: string;
    name: string;
    category_id: string | null;
    logo_url: string | null;
    website: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface Transaction {
    id: string;
    ledger_id: string;
    account_id: string;
    category_id: string | null;
    merchant_id: string | null;
    txn_type: TxnType;
    amount: number;
    currency_code: string;
    date: string;
    description: string | null;
    notes: string | null;
    is_split: boolean;
    transfer_peer_id: string | null;
    refund_of_id: string | null;
    is_reconciled: boolean;
    reconciled_at: string | null;
    external_id: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface TransactionSplit {
    id: string;
    transaction_id: string;
    category_id: string | null;
    amount: number;
    description: string | null;
    created_at: string;
    updated_at: string;
}

export interface TransactionTag {
    transaction_id: string;
    tag_id: string;
    created_at: string;
}

export interface Budget {
    id: string;
    ledger_id: string;
    category_id: string | null;
    name: string;
    amount: number;
    period: BudgetPeriod;
    start_date: string;
    end_date: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface BudgetAlert {
    id: string;
    budget_id: string;
    threshold_pct: number;
    triggered_at: string | null;
    notified: boolean;
    created_at: string;
    updated_at: string;
}

export interface Subscription {
    id: string;
    ledger_id: string;
    account_id: string | null;
    category_id: string | null;
    merchant_id: string | null;
    name: string;
    amount: number;
    currency_code: string;
    interval: SubscriptionInterval;
    next_due_date: string;
    is_active: boolean;
    auto_create_txn: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface ExchangeRate {
    id: string;
    base_currency: string;
    quote_currency: string;
    rate: number;
    rate_date: string;
    source: string | null;
    created_at: string;
}

export interface ClassificationRule {
    id: string;
    ledger_id: string;
    match_field: string;
    match_pattern: string;
    category_id: string | null;
    merchant_id: string | null;
    priority: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface MonthlySummary {
    id: string;
    ledger_id: string;
    year_month: string;
    total_income: number;
    total_expense: number;
    total_transfers: number;
    net_savings: number;
    currency_code: string;
    computed_at: string;
    created_at: string;
    updated_at: string;
}

export interface Insight {
    id: string;
    ledger_id: string;
    title: string;
    body: string | null;
    insight_type: string;
    data: Record<string, unknown> | null;
    is_read: boolean;
    created_at: string;
    updated_at: string;
}

export interface Notification {
    id: string;
    user_id: string;
    ledger_id: string | null;
    notification_type: NotificationType;
    title: string;
    body: string | null;
    data: Record<string, unknown> | null;
    is_read: boolean;
    created_at: string;
}

export interface ReconciliationSnapshot {
    id: string;
    ledger_id: string;
    account_id: string;
    snapshot_date: string;
    statement_balance: number;
    computed_balance: number;
    difference: number;
    is_reconciled: boolean;
    reconciled_by: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
}

export interface AuditLog {
    id: string;
    ledger_id: string;
    table_name: string;
    record_id: string;
    action: string;
    actor_id: string | null;
    before_data: Record<string, unknown> | null;
    after_data: Record<string, unknown> | null;
    created_at: string;
}

export interface Attachment {
    id: string;
    ledger_id: string;
    transaction_id: string | null;
    storage_path: string;
    file_name: string;
    file_size: number | null;
    mime_type: string | null;
    uploaded_by: string;
    created_at: string;
    updated_at: string;
}

export interface OcrJob {
    id: string;
    ledger_id: string;
    attachment_id: string | null;
    status: OcrStatus;
    raw_text: string | null;
    parsed_data: Record<string, unknown> | null;
    error_message: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface ExportJob {
    id: string;
    ledger_id: string;
    format: ExportFormat;
    filters: Record<string, unknown> | null;
    status: string;
    storage_path: string | null;
    error_message: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface MonthClosure {
    id: string;
    ledger_id: string;
    year_month: string;
    closed_by: string;
    closed_at: string;
    notes: string | null;
    created_at: string;
}

// ============================================================
// DATABASE TYPE (for supabase-js generic parameter)
// ============================================================

export interface Database {
    public: {
        Tables: {
            profiles: { Row: Profile; Insert: Partial<Profile> & Pick<Profile, "id" | "email">; Update: Partial<Profile> };
            ledgers: { Row: Ledger; Insert: Partial<Ledger> & Pick<Ledger, "name" | "created_by">; Update: Partial<Ledger> };
            ledger_members: { Row: LedgerMember; Insert: Partial<LedgerMember> & Pick<LedgerMember, "ledger_id" | "user_id">; Update: Partial<LedgerMember> };
            accounts: { Row: Account; Insert: Partial<Account> & Pick<Account, "ledger_id" | "name">; Update: Partial<Account> };
            categories: { Row: Category; Insert: Partial<Category> & Pick<Category, "ledger_id" | "name">; Update: Partial<Category> };
            tags: { Row: Tag; Insert: Partial<Tag> & Pick<Tag, "ledger_id" | "name">; Update: Partial<Tag> };
            merchants: { Row: Merchant; Insert: Partial<Merchant> & Pick<Merchant, "ledger_id" | "name">; Update: Partial<Merchant> };
            transactions: { Row: Transaction; Insert: Partial<Transaction> & Pick<Transaction, "ledger_id" | "account_id" | "txn_type" | "amount" | "created_by">; Update: Partial<Transaction> };
            transaction_splits: { Row: TransactionSplit; Insert: Partial<TransactionSplit> & Pick<TransactionSplit, "transaction_id" | "amount">; Update: Partial<TransactionSplit> };
            transaction_tags: { Row: TransactionTag; Insert: Pick<TransactionTag, "transaction_id" | "tag_id">; Update: never };
            budgets: { Row: Budget; Insert: Partial<Budget> & Pick<Budget, "ledger_id" | "name" | "amount" | "start_date">; Update: Partial<Budget> };
            budget_alerts: { Row: BudgetAlert; Insert: Partial<BudgetAlert> & Pick<BudgetAlert, "budget_id">; Update: Partial<BudgetAlert> };
            subscriptions: { Row: Subscription; Insert: Partial<Subscription> & Pick<Subscription, "ledger_id" | "name" | "amount" | "next_due_date">; Update: Partial<Subscription> };
            exchange_rates: { Row: ExchangeRate; Insert: Partial<ExchangeRate> & Pick<ExchangeRate, "base_currency" | "quote_currency" | "rate">; Update: Partial<ExchangeRate> };
            classification_rules: { Row: ClassificationRule; Insert: Partial<ClassificationRule> & Pick<ClassificationRule, "ledger_id" | "match_pattern">; Update: Partial<ClassificationRule> };
            monthly_summaries: { Row: MonthlySummary; Insert: Partial<MonthlySummary> & Pick<MonthlySummary, "ledger_id" | "year_month">; Update: Partial<MonthlySummary> };
            insights: { Row: Insight; Insert: Partial<Insight> & Pick<Insight, "ledger_id" | "title">; Update: Partial<Insight> };
            notifications: { Row: Notification; Insert: Partial<Notification> & Pick<Notification, "user_id" | "notification_type" | "title">; Update: Partial<Notification> };
            reconciliation_snapshots: { Row: ReconciliationSnapshot; Insert: Partial<ReconciliationSnapshot> & Pick<ReconciliationSnapshot, "ledger_id" | "account_id" | "snapshot_date" | "statement_balance" | "computed_balance">; Update: Partial<ReconciliationSnapshot> };
            audit_logs: { Row: AuditLog; Insert: Partial<AuditLog> & Pick<AuditLog, "ledger_id" | "table_name" | "record_id" | "action">; Update: never };
            attachments: { Row: Attachment; Insert: Partial<Attachment> & Pick<Attachment, "ledger_id" | "storage_path" | "file_name" | "uploaded_by">; Update: Partial<Attachment> };
            ocr_jobs: { Row: OcrJob; Insert: Partial<OcrJob> & Pick<OcrJob, "ledger_id" | "created_by">; Update: Partial<OcrJob> };
            export_jobs: { Row: ExportJob; Insert: Partial<ExportJob> & Pick<ExportJob, "ledger_id" | "created_by">; Update: Partial<ExportJob> };
            month_closures: { Row: MonthClosure; Insert: Partial<MonthClosure> & Pick<MonthClosure, "ledger_id" | "year_month" | "closed_by">; Update: never };
        };
        Enums: {
            ledger_role: LedgerRole;
            txn_type: TxnType;
            account_type: AccountType;
            budget_period: BudgetPeriod;
            subscription_interval: SubscriptionInterval;
            notification_type: NotificationType;
            export_format: ExportFormat;
            ocr_status: OcrStatus;
        };
    };
}
