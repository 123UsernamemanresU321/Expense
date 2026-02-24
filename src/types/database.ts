// =============================================================================
// Database Types — generated from Phase 1 schema (01_enums_tables.sql)
// =============================================================================

// --- Enums ---
export type AccountType = "checking" | "savings" | "credit_card" | "cash" | "investment" | "loan" | "other";
export type TxnType = "income" | "expense" | "transfer" | "refund" | "adjustment";
export type LedgerRole = "owner" | "admin" | "editor" | "viewer";
export type BudgetPeriod = "weekly" | "monthly" | "quarterly" | "yearly";
export type SubInterval = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type ExportFormat = "csv" | "xlsx" | "pdf" | "json";
export type JobStatus = "pending" | "processing" | "completed" | "failed";
export type ImportStatus = "pending" | "mapping" | "processing" | "completed" | "failed";
export type NotificationType = "budget_warning" | "budget_exceeded" | "subscription_due" | "member_added" | "month_closed" | "insight" | "system";

// --- Row Types ---
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
    fiscal_year_start: number;
    created_by: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface LedgerMember {
    id: string;
    ledger_id: string;
    user_id: string;
    role: LedgerRole;
    invited_by: string | null;
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
    institution: string | null;
    mask: string | null;
    is_active: boolean;
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
    is_active: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
    // Computed for tree
    children?: Category[];
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
    is_reconciled: boolean;
    reconciled_at: string | null;
    refund_of_id: string | null;
    transfer_peer_id: string | null;
    external_id: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    // Joined
    category?: { name: string } | null;
    merchant?: { name: string } | null;
    account?: { name: string } | null;
    tags?: Tag[];
    splits?: TransactionSplit[];
}

export interface TransactionSplit {
    id: string;
    transaction_id: string;
    category_id: string;
    amount: number;
    description: string | null;
    created_at: string;
    updated_at: string;
    category?: { name: string } | null;
}

export interface TransactionTag {
    transaction_id: string;
    tag_id: string;
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
    alerts?: BudgetAlert[];
    category?: { name: string } | null;
}

export interface BudgetAlert {
    id: string;
    budget_id: string;
    threshold_pct: number;
    notified_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface Subscription {
    id: string;
    ledger_id: string;
    account_id: string;
    category_id: string | null;
    merchant_id: string | null;
    name: string;
    amount: number;
    currency_code: string;
    interval: SubInterval;
    next_due_date: string;
    is_active: boolean;
    notes: string | null;
    created_at: string;
    updated_at: string;
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
    computed_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface MonthClosure {
    id: string;
    ledger_id: string;
    year_month: string;
    closed_by: string;
    notes: string | null;
    created_at: string;
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
}

export interface Notification {
    id: string;
    user_id: string;
    ledger_id: string | null;
    notification_type: NotificationType;
    title: string;
    body: string | null;
    is_read: boolean;
    dismissed_at: string | null;
    created_at: string;
}

export interface ExportJob {
    id: string;
    ledger_id: string;
    format: ExportFormat;
    filters: Record<string, unknown> | null;
    status: JobStatus;
    storage_path: string | null;
    error_message: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
}

export interface ImportJob {
    id: string;
    ledger_id: string;
    storage_path: string;
    file_name: string;
    status: ImportStatus;
    column_mapping: Record<string, string> | null;
    total_rows: number;
    imported_rows: number;
    skipped_rows: number;
    error_rows: number;
    errors: { row: number; error: string }[] | null;
    created_by: string;
    created_at: string;
    updated_at: string;
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
}

export interface AuditLog {
    id: string;
    ledger_id: string | null;
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
    mime_type: string | null;
    size_bytes: number | null;
    created_by: string;
    created_at: string;
}

export interface OcrJob {
    id: string;
    ledger_id: string;
    attachment_id: string;
    status: JobStatus;
    raw_text: string | null;
    parsed_data: Record<string, unknown> | null;
    error_message: string | null;
    created_by: string;
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
