import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import { callEdgeFunction } from "@/lib/supabase/edge-functions";
import type { Account, ReconciliationSnapshot } from "@/types/database";

export async function getAccounts(ledgerId: string): Promise<Account[]> {
    return unwrap(
        await supabase.from("accounts").select("*").eq("ledger_id", ledgerId).order("sort_order")
    );
}

export async function createAccount(data: {
    ledger_id: string;
    name: string;
    account_type: Account["account_type"];
    currency_code?: string;
    balance?: number;
    institution?: string;
    sort_order?: number;
}): Promise<Account> {
    return unwrap(
        await supabase.from("accounts").insert(data).select().single()
    );
}

export async function updateAccount(id: string, updates: Partial<Pick<Account, "name" | "account_type" | "balance" | "institution" | "mask" | "is_active" | "sort_order">>): Promise<Account> {
    return unwrap(
        await supabase.from("accounts").update(updates).eq("id", id).select().single()
    );
}

export async function deleteAccount(id: string): Promise<void> {
    unwrap(await supabase.from("accounts").update({ is_active: false }).eq("id", id));
}

// --- Reconciliation (via Edge Function) ---

export async function reconcileAccount(input: {
    ledger_id: string;
    account_id: string;
    snapshot_date: string;
    statement_balance: number;
}) {
    return callEdgeFunction<{
        success: boolean;
        computed_balance: number;
        statement_balance: number;
        difference: number;
        is_reconciled: boolean;
        transactions_checked: number;
    }>("reconcile-snapshot-helper", input);
}

export async function getReconciliationHistory(ledgerId: string, accountId: string): Promise<ReconciliationSnapshot[]> {
    return unwrap(
        await supabase
            .from("reconciliation_snapshots")
            .select("*")
            .eq("ledger_id", ledgerId)
            .eq("account_id", accountId)
            .order("snapshot_date", { ascending: false })
    );
}
