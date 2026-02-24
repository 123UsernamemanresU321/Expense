// =============================================================================
// reconcile-snapshot-helper — Self-contained Edge Function
// Paste this ENTIRE file into the Supabase Dashboard Edge Functions editor
// =============================================================================
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
async function getUid(admin: SupabaseClient, ah: string | null): Promise<string | null> {
    if (!ah) return null;
    const { data } = await admin.auth.getUser(ah.replace("Bearer ", ""));
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

        const { data: account, error: acctErr } = await admin.from("accounts").select("id, name, balance").eq("id", account_id).eq("ledger_id", ledger_id).single();
        if (acctErr || !account) return json({ error: "Account not found in this ledger" }, 404);

        const { data: txns, error: txnErr } = await admin.from("transactions").select("txn_type, amount").eq("account_id", account_id).eq("ledger_id", ledger_id).lte("date", snapshot_date);
        if (txnErr) throw { status: 500, message: txnErr.message };

        let computed = 0;
        for (const t of txns ?? []) {
            const amt = Number(t.amount);
            switch (t.txn_type) {
                case "income": case "refund": computed += amt; break;
                case "expense": computed -= amt; break;
                case "adjustment": computed += amt; break;
            }
        }

        const stmtBal = Number(statement_balance);
        const diff = Math.round((stmtBal - computed) * 100) / 100;
        const reconciled = Math.abs(diff) < 0.01;

        const { data: snapshot, error: snapErr } = await admin.from("reconciliation_snapshots").insert({
            ledger_id, account_id, snapshot_date,
            statement_balance: stmtBal, computed_balance: computed,
            difference: diff, is_reconciled: reconciled, reconciled_by: ctx.userId,
            notes: reconciled ? "Balances match" : `Discrepancy: $${Math.abs(diff).toFixed(2)}`,
        }).select().single();
        if (snapErr) throw { status: 500, message: snapErr.message };

        if (reconciled) {
            await admin.from("transactions").update({ is_reconciled: true, reconciled_at: new Date().toISOString() })
                .eq("account_id", account_id).eq("ledger_id", ledger_id).lte("date", snapshot_date).eq("is_reconciled", false);
        }

        await admin.from("audit_logs").insert({
            ledger_id, table_name: "reconciliation_snapshots", record_id: snapshot?.id ?? account_id,
            action: "RECONCILE", actor_id: ctx.userId,
            after_data: { account_id, snapshot_date, statement_balance: stmtBal, computed_balance: computed, difference: diff, is_reconciled: reconciled, txn_count: (txns ?? []).length },
        });

        return json({ success: true, account_name: account.name, snapshot_date, statement_balance: stmtBal, computed_balance: computed, difference: diff, is_reconciled: reconciled, transactions_checked: (txns ?? []).length });
    } catch (err: unknown) {
        if (err && typeof err === "object" && "status" in err) { const e = err as { status: number; message: string }; return json({ error: e.message }, e.status); }
        console.error(err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
});
