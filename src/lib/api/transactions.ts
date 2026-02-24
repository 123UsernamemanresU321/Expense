import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import type { Transaction, TransactionSplit, TxnType } from "@/types/database";

// --- Queries ---

export interface TxnFilters {
    ledgerId: string;
    startDate?: string;
    endDate?: string;
    txnType?: TxnType;
    accountId?: string;
    categoryId?: string;
    search?: string;
    limit?: number;
    offset?: number;
}

export async function getTransactions(f: TxnFilters): Promise<Transaction[]> {
    let q = supabase
        .from("transactions")
        .select("*, category:categories(name), merchant:merchants(name), account:accounts(name)")
        .eq("ledger_id", f.ledgerId)
        .order("date", { ascending: false });

    if (f.startDate) q = q.gte("date", f.startDate);
    if (f.endDate) q = q.lte("date", f.endDate);
    if (f.txnType) q = q.eq("txn_type", f.txnType);
    if (f.accountId) q = q.eq("account_id", f.accountId);
    if (f.categoryId) q = q.eq("category_id", f.categoryId);
    if (f.search) q = q.ilike("description", `%${f.search}%`);
    if (f.limit) q = q.limit(f.limit);
    if (f.offset) q = q.range(f.offset, f.offset + (f.limit ?? 50) - 1);

    return unwrap(await q);
}

export async function getTransaction(id: string): Promise<Transaction> {
    return unwrap(
        await supabase
            .from("transactions")
            .select("*, category:categories(name), merchant:merchants(name), account:accounts(name)")
            .eq("id", id)
            .single()
    );
}

export async function getSplits(transactionId: string): Promise<TransactionSplit[]> {
    return unwrap(
        await supabase
            .from("transaction_splits")
            .select("*, category:categories(name)")
            .eq("transaction_id", transactionId)
            .order("created_at")
    );
}

export async function getTransactionTags(transactionId: string): Promise<string[]> {
    const rows = unwrap(
        await supabase.from("transaction_tags").select("tag_id").eq("transaction_id", transactionId)
    );
    return rows.map((r: { tag_id: string }) => r.tag_id);
}

// --- Mutations ---

export interface CreateTxnInput {
    ledger_id: string;
    account_id: string;
    category_id?: string;
    merchant_id?: string;
    txn_type: TxnType;
    amount: number;
    currency_code?: string;
    date: string;
    description?: string;
    notes?: string;
    tag_ids?: string[];
}

export async function createTransaction(input: CreateTxnInput): Promise<Transaction> {
    const { data: { user } } = await supabase.auth.getUser();
    const { tag_ids, ...txnData } = input;

    const txn: Transaction = unwrap(
        await supabase.from("transactions").insert({ ...txnData, created_by: user!.id }).select().single()
    );

    if (tag_ids && tag_ids.length > 0) {
        await supabase.from("transaction_tags").insert(
            tag_ids.map((tag_id) => ({ transaction_id: txn.id, tag_id }))
        );
    }

    return txn;
}

export async function updateTransaction(id: string, updates: Partial<Pick<Transaction, "account_id" | "category_id" | "merchant_id" | "amount" | "date" | "description" | "notes">>): Promise<Transaction> {
    return unwrap(
        await supabase.from("transactions").update(updates).eq("id", id).select().single()
    );
}

export async function deleteTransaction(id: string): Promise<void> {
    unwrap(await supabase.from("transactions").delete().eq("id", id));
}

// --- Splits ---

export async function createSplit(transactionId: string, splits: { category_id: string; amount: number; description?: string }[]): Promise<void> {
    // Mark parent as split
    await supabase.from("transactions").update({ is_split: true }).eq("id", transactionId);

    unwrap(
        await supabase.from("transaction_splits").insert(
            splits.map((s) => ({ transaction_id: transactionId, ...s }))
        )
    );
}

export async function deleteSplits(transactionId: string): Promise<void> {
    unwrap(await supabase.from("transaction_splits").delete().eq("transaction_id", transactionId));
    await supabase.from("transactions").update({ is_split: false }).eq("id", transactionId);
}

// --- Refund ---

export async function createRefund(originalTxnId: string, input: Omit<CreateTxnInput, "txn_type">): Promise<Transaction> {
    const { data: { user } } = await supabase.auth.getUser();
    const { tag_ids, ...txnData } = input;

    return unwrap(
        await supabase.from("transactions").insert({
            ...txnData,
            txn_type: "refund" as TxnType,
            refund_of_id: originalTxnId,
            created_by: user!.id,
        }).select().single()
    );
}

// --- Transfer ---

export async function createTransfer(input: {
    ledger_id: string;
    from_account_id: string;
    to_account_id: string;
    amount: number;
    date: string;
    description?: string;
}): Promise<{ from: Transaction; to: Transaction }> {
    const { data: { user } } = await supabase.auth.getUser();
    const fromId = crypto.randomUUID();
    const toId = crypto.randomUUID();

    const [from, to] = await Promise.all([
        supabase.from("transactions").insert({
            id: fromId,
            ledger_id: input.ledger_id,
            account_id: input.from_account_id,
            txn_type: "transfer" as TxnType,
            amount: input.amount,
            date: input.date,
            description: input.description ?? "Transfer out",
            transfer_peer_id: toId,
            created_by: user!.id,
        }).select().single(),
        supabase.from("transactions").insert({
            id: toId,
            ledger_id: input.ledger_id,
            account_id: input.to_account_id,
            txn_type: "transfer" as TxnType,
            amount: input.amount,
            date: input.date,
            description: input.description ?? "Transfer in",
            transfer_peer_id: fromId,
            created_by: user!.id,
        }).select().single(),
    ]);

    return { from: unwrap(from), to: unwrap(to) };
}
