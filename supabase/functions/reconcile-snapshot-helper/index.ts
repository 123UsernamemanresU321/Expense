// =============================================================================
// reconcile-snapshot-helper — Self-contained Edge Function
// Paste this ENTIRE file into the Supabase Dashboard Edge Functions editor
// =============================================================================
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret, x-user-jwt",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function adminClient(): SupabaseClient {
    return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

type ReconcileTransaction = {
    txn_type: string;
    amount: number | string;
    currency_code: string | null;
    date: string;
    description: string | null;
};

function roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
}

function getTransactionDelta(txn: ReconcileTransaction): number {
    const amount = Number(txn.amount);
    switch (txn.txn_type) {
        case "income":
        case "refund":
        case "adjustment":
            return amount;
        case "expense":
            return -amount;
        case "transfer": {
            const description = (txn.description ?? "").toLowerCase();
            if (/\btransfer\s+in\b/.test(description) || /\bfrom\b/.test(description)) return amount;
            if (/\btransfer\s+out\b/.test(description) || /\bto\b/.test(description)) return -amount;
            return -amount;
        }
        default:
            return 0;
    }
}

async function convertCurrency(
    admin: SupabaseClient,
    amount: number,
    fromCurrency: string | null,
    toCurrency: string,
    date: string,
): Promise<number> {
    const from = fromCurrency ?? toCurrency;
    if (from === toCurrency) return amount;

    const { data: datedRate } = await admin
        .from("exchange_rates")
        .select("rate")
        .eq("base_currency", from)
        .eq("quote_currency", toCurrency)
        .lte("rate_date", date)
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (datedRate?.rate != null) return amount * Number(datedRate.rate);

    const { data: fallbackRate } = await admin
        .from("exchange_rates")
        .select("rate")
        .eq("base_currency", from)
        .eq("quote_currency", toCurrency)
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();

    return fallbackRate?.rate != null ? amount * Number(fallbackRate.rate) : amount;
}

async function getUid(admin: SupabaseClient, ah: string | null): Promise<string | null> {
    if (!ah) return null;
    const { data } = await admin.auth.getUser(ah.replace(/Bearer\s+/i, ""));
    return data?.user?.id ?? null;
}
async function requireMember(admin: SupabaseClient, ah: string | null, lid: string, roles?: string[]) {
    const uid = await getUid(admin, ah);
    if (!uid) throw { status: 401, message: "Unauthorized" };
    const { data: m } = await admin.from("ledger_members").select("role").eq("ledger_id", lid).eq("user_id", uid).single();
    if (!m) throw { status: 403, message: "Not a member" };
    if (roles && !roles.includes(m.role)) throw { status: 403, message: `Requires: ${roles.join("|")}` };
    return { userId: uid, role: m.role };
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
        const authHeader = req.headers.get("authorization");
        const { ledger_id, account_id, snapshot_date, statement_balance } = await req.json();
        if (!ledger_id || !account_id || !snapshot_date || statement_balance == null) {
            return json({ error: "ledger_id, account_id, snapshot_date, statement_balance required" }, 400);
        }

        const admin = adminClient();
        const ctx = await requireMember(admin, authHeader, ledger_id, ["owner", "admin", "editor"]);

        const { data: account, error: acctErr } = await admin.from("accounts").select("id, name, balance, currency_code").eq("id", account_id).eq("ledger_id", ledger_id).single();
        if (acctErr || !account) return json({ error: "Account not found in this ledger" }, 404);

        const { count: checkedTxnCount, error: countErr } = await admin
            .from("transactions")
            .select("id", { count: "exact", head: true })
            .eq("account_id", account_id)
            .eq("ledger_id", ledger_id)
            .lte("date", snapshot_date);
        if (countErr) throw { status: 500, message: countErr.message };

        const { data: afterTxns, error: txnErr } = await admin
            .from("transactions")
            .select("txn_type, amount, currency_code, date, description")
            .eq("account_id", account_id)
            .eq("ledger_id", ledger_id)
            .gt("date", snapshot_date);
        if (txnErr) throw { status: 500, message: txnErr.message };

        let deltaAfterSnapshot = 0;
        for (const txn of afterTxns ?? []) {
            const delta = getTransactionDelta(txn as ReconcileTransaction);
            deltaAfterSnapshot += await convertCurrency(admin, delta, txn.currency_code, account.currency_code, txn.date);
        }

        const computed = roundCurrency(Number(account.balance) - deltaAfterSnapshot);
        const stmtBal = Number(statement_balance);
        const diff = roundCurrency(stmtBal - computed);
        const reconciled = Math.abs(diff) < 0.01;

        const { data: snapshot, error: snapErr } = await admin.from("reconciliation_snapshots").insert({
            ledger_id, account_id, snapshot_date,
            statement_balance: stmtBal, computed_balance: computed,
            difference: diff, is_reconciled: reconciled, reconciled_by: ctx.userId,
            notes: reconciled ? "Balances match" : `Discrepancy: ${account.currency_code} ${Math.abs(diff).toFixed(2)}`,
        }).select().single();
        if (snapErr) throw { status: 500, message: snapErr.message };

        if (reconciled) {
            await admin.from("transactions").update({ is_reconciled: true, reconciled_at: new Date().toISOString() })
                .eq("account_id", account_id).eq("ledger_id", ledger_id).lte("date", snapshot_date).eq("is_reconciled", false);
        }

        await admin.from("audit_logs").insert({
            ledger_id, table_name: "reconciliation_snapshots", record_id: snapshot?.id ?? account_id,
            action: "RECONCILE", actor_id: ctx.userId,
            after_data: { account_id, snapshot_date, statement_balance: stmtBal, computed_balance: computed, difference: diff, is_reconciled: reconciled, txn_count: checkedTxnCount ?? 0, transactions_after_snapshot: (afterTxns ?? []).length },
        });

        return json({ success: true, account_name: account.name, account_currency: account.currency_code, snapshot_date, statement_balance: stmtBal, computed_balance: computed, difference: diff, is_reconciled: reconciled, transactions_checked: checkedTxnCount ?? 0 });
    } catch (err: unknown) {
        if (err && typeof err === "object" && "status" in err) { const e = err as { status: number; message: string }; return json({ error: e.message }, e.status); }
        console.error(err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
});
