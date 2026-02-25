// =============================================================================
// apply-classification-rules — Self-contained Edge Function
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
        const { ledger_id, mode, lookback_days } = await req.json();
        if (!ledger_id || !mode) return json({ error: "ledger_id and mode ('test'|'apply') required" }, 400);
        if (mode !== "test" && mode !== "apply") return json({ error: "mode must be 'test' or 'apply'" }, 400);

        const admin = adminClient();
        const ctx = await requireMember(admin, authHeader, ledger_id, ["owner", "admin", "editor"]);

        const days = lookback_days ?? 30;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        const cutoffDate = cutoff.toISOString().slice(0, 10);

        const { data: rules, error: ruleErr } = await admin.from("classification_rules").select("*").eq("ledger_id", ledger_id).eq("is_active", true).order("priority", { ascending: false });
        if (ruleErr) throw { status: 500, message: ruleErr.message };
        if (!rules || rules.length === 0) return json({ success: true, message: "No active rules found", matches: 0 });

        const { data: txns, error: txnErr } = await admin.from("transactions").select("id, description, category_id, merchant_id, notes").eq("ledger_id", ledger_id).gte("date", cutoffDate).in("txn_type", ["income", "expense"]);
        if (txnErr) throw { status: 500, message: txnErr.message };

        type Match = { transaction_id: string; description: string; rule_id: string; pattern: string; new_category_id: string | null; new_merchant_id: string | null };
        const matches: Match[] = [];

        for (const txn of txns ?? []) {
            for (const rule of rules) {
                const field = rule.match_field === "notes" ? txn.notes : txn.description;
                if (!field) continue;
                const pattern = rule.match_pattern.replace(/%/g, ".*").replace(/_/g, ".");
                if (new RegExp(pattern, "i").test(field)) {
                    matches.push({ transaction_id: txn.id, description: txn.description ?? "", rule_id: rule.id, pattern: rule.match_pattern, new_category_id: rule.category_id, new_merchant_id: rule.merchant_id });
                    break; // first match wins
                }
            }
        }

        if (mode === "test") {
            return json({ success: true, mode: "test", total_transactions: (txns ?? []).length, matched: matches.length, rules_evaluated: rules.length, sample: matches.slice(0, 20) });
        }

        let applied = 0;
        for (const m of matches) {
            const updates: Record<string, unknown> = {};
            if (m.new_category_id) updates.category_id = m.new_category_id;
            if (m.new_merchant_id) updates.merchant_id = m.new_merchant_id;
            if (Object.keys(updates).length === 0) continue;
            const { error: updErr } = await admin.from("transactions").update(updates).eq("id", m.transaction_id);
            if (!updErr) applied++;
        }

        await admin.from("audit_logs").insert({
            ledger_id, table_name: "transactions",
            record_id: "00000000-0000-0000-0000-000000000000",
            action: "BULK_CLASSIFY", actor_id: ctx.userId,
            after_data: { rules_evaluated: rules.length, matched: matches.length, applied, lookback_days: days },
        });

        return json({ success: true, mode: "apply", total_transactions: (txns ?? []).length, matched: matches.length, applied, rules_evaluated: rules.length });
    } catch (err: unknown) {
        if (err && typeof err === "object" && "status" in err) { const e = err as { status: number; message: string }; return json({ error: e.message }, e.status); }
        console.error(err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
});
