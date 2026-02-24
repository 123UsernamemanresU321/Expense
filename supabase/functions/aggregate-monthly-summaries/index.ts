// =============================================================================
// aggregate-monthly-summaries — Self-contained Edge Function
// Paste this ENTIRE file into the Supabase Dashboard Edge Functions editor
// =============================================================================
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// --- Inline Helpers ---
const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
}

function adminClient(): SupabaseClient {
    return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

async function getUid(admin: SupabaseClient, authHeader: string | null): Promise<string | null> {
    if (!authHeader) return null;
    const { data } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    return data?.user?.id ?? null;
}

async function requireMember(admin: SupabaseClient, authHeader: string | null, ledgerId: string, roles?: string[]) {
    const uid = await getUid(admin, authHeader);
    if (!uid) throw { status: 401, message: "Unauthorized" };
    const { data: m } = await admin.from("ledger_members").select("role").eq("ledger_id", ledgerId).eq("user_id", uid).single();
    if (!m) throw { status: 403, message: "Not a member of this ledger" };
    if (roles && !roles.includes(m.role)) throw { status: 403, message: `Requires role: ${roles.join("|")}` };
    return { userId: uid, role: m.role as string };
}

// --- Main Handler ---
Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
        const authHeader = req.headers.get("authorization");
        const { ledger_id, month, backfill_months } = await req.json();
        if (!ledger_id || !month) return json({ error: "ledger_id and month (YYYY-MM) required" }, 400);

        const admin = adminClient();
        await requireMember(admin, authHeader, ledger_id, ["owner", "admin", "editor"]);

        const months: string[] = [];
        const backfill = backfill_months ?? 0;
        for (let i = backfill; i >= 0; i--) {
            const d = new Date(`${month}-01T00:00:00Z`);
            d.setUTCMonth(d.getUTCMonth() - i);
            months.push(d.toISOString().slice(0, 7));
        }

        const results = [];
        for (const ym of months) {
            const startDate = `${ym}-01`;
            const endD = new Date(`${ym}-01T00:00:00Z`);
            endD.setUTCMonth(endD.getUTCMonth() + 1);
            const endDate = endD.toISOString().slice(0, 10);

            const { data: txns, error: txnErr } = await admin
                .from("transactions")
                .select("txn_type, amount, category_id")
                .eq("ledger_id", ledger_id)
                .gte("date", startDate)
                .lt("date", endDate);
            if (txnErr) throw { status: 500, message: txnErr.message };

            let totalIncome = 0, totalExpense = 0, totalTransfers = 0, totalRefunds = 0;
            const catBreak: Record<string, { income: number; expense: number }> = {};

            for (const t of txns ?? []) {
                const amt = Number(t.amount);
                const cat = t.category_id ?? "uncategorized";
                if (!catBreak[cat]) catBreak[cat] = { income: 0, expense: 0 };
                switch (t.txn_type) {
                    case "income": totalIncome += amt; catBreak[cat].income += amt; break;
                    case "expense": totalExpense += amt; catBreak[cat].expense += amt; break;
                    case "transfer": totalTransfers += amt; break;
                    case "refund": totalRefunds += amt; break;
                }
            }

            const netSavings = totalIncome - totalExpense + totalRefunds;
            const { error: uErr } = await admin.from("monthly_summaries").upsert({
                ledger_id, year_month: ym,
                total_income: totalIncome, total_expense: totalExpense,
                total_transfers: totalTransfers, net_savings: netSavings,
                computed_at: new Date().toISOString(),
            }, { onConflict: "ledger_id,year_month" });
            if (uErr) throw { status: 500, message: uErr.message };

            results.push({
                year_month: ym, total_income: totalIncome, total_expense: totalExpense,
                total_transfers: totalTransfers, total_refunds: totalRefunds,
                net_savings: netSavings, transaction_count: txns?.length ?? 0,
                category_breakdown: catBreak,
            });
        }

        return json({ success: true, months_processed: results.length, summaries: results });
    } catch (err: unknown) {
        if (err && typeof err === "object" && "status" in err) {
            const e = err as { status: number; message: string };
            return json({ error: e.message }, e.status);
        }
        console.error(err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
});
