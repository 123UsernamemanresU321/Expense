// =============================================================================
// generate-insights — Self-contained Edge Function
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

interface Insight { title: string; body: string; insight_type: string; data: Record<string, unknown>; }

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
        const authHeader = req.headers.get("authorization");
        const { ledger_id, month } = await req.json();
        if (!ledger_id || !month) return json({ error: "ledger_id and month (YYYY-MM) required" }, 400);

        const admin = adminClient();
        await requireMember(admin, authHeader, ledger_id, ["owner", "admin", "editor"]);

        const startDate = `${month}-01`;
        const endD = new Date(`${month}-01T00:00:00Z`);
        endD.setUTCMonth(endD.getUTCMonth() + 1);
        const endDate = endD.toISOString().slice(0, 10);
        const prevD = new Date(`${month}-01T00:00:00Z`);
        prevD.setUTCMonth(prevD.getUTCMonth() - 1);
        const prevMonth = prevD.toISOString().slice(0, 7);
        const prevStart = `${prevMonth}-01`;

        const { data: currTxns } = await admin.from("transactions").select("txn_type, amount, category_id, merchant_id")
            .eq("ledger_id", ledger_id).gte("date", startDate).lt("date", endDate).in("txn_type", ["income", "expense"]);
        const { data: prevTxns } = await admin.from("transactions").select("txn_type, amount, category_id, merchant_id")
            .eq("ledger_id", ledger_id).gte("date", prevStart).lt("date", startDate).in("txn_type", ["income", "expense"]);
        const { data: subs } = await admin.from("subscriptions").select("name, amount").eq("ledger_id", ledger_id).eq("is_active", true);
        const { data: cats } = await admin.from("categories").select("id, name").eq("ledger_id", ledger_id);

        const catNames: Record<string, string> = {};
        for (const c of cats ?? []) catNames[c.id] = c.name;
        const insights: Insight[] = [];

        // RULE 1: MoM category spending spikes (>30% increase)
        const currCat: Record<string, number> = {};
        const prevCat: Record<string, number> = {};
        for (const t of currTxns ?? []) { if (t.txn_type === "expense" && t.category_id) currCat[t.category_id] = (currCat[t.category_id] ?? 0) + Number(t.amount); }
        for (const t of prevTxns ?? []) { if (t.txn_type === "expense" && t.category_id) prevCat[t.category_id] = (prevCat[t.category_id] ?? 0) + Number(t.amount); }

        for (const [catId, curr] of Object.entries(currCat)) {
            const prev = prevCat[catId] ?? 0;
            if (prev > 0 && curr > prev * 1.3) {
                const pct = Math.round(((curr - prev) / prev) * 100);
                insights.push({ title: `${catNames[catId] ?? "Category"} spending up ${pct}%`, body: `$${curr.toFixed(2)} this month vs $${prev.toFixed(2)} last month.`, insight_type: "category_spike", data: { category_id: catId, current: curr, previous: prev, pct } });
            }
        }

        // RULE 2: Category spending decrease (>50% drop, min $50 prev)
        for (const [catId, prev] of Object.entries(prevCat)) {
            const curr = currCat[catId] ?? 0;
            if (prev > 50 && curr < prev * 0.5) {
                const pct = Math.round(((prev - curr) / prev) * 100);
                insights.push({ title: `${catNames[catId] ?? "Category"} spending down ${pct}%`, body: `Great job! $${curr.toFixed(2)} vs $${prev.toFixed(2)} last month.`, insight_type: "category_savings", data: { category_id: catId, current: curr, previous: prev, pct } });
            }
        }

        // RULE 3: Subscription creep (>15% of income)
        const totalSubCost = (subs ?? []).reduce((s, sub) => s + Number(sub.amount), 0);
        const totalIncome = (currTxns ?? []).filter(t => t.txn_type === "income").reduce((s, t) => s + Number(t.amount), 0);
        if (totalIncome > 0 && totalSubCost / totalIncome > 0.15) {
            const pct = Math.round((totalSubCost / totalIncome) * 100);
            insights.push({ title: `Subscriptions are ${pct}% of income`, body: `${(subs ?? []).length} active subscriptions total $${totalSubCost.toFixed(2)}/month.`, insight_type: "subscription_creep", data: { total_cost: totalSubCost, income: totalIncome, pct, count: (subs ?? []).length } });
        }

        // RULE 4: Top merchant change
        const currMerch: Record<string, number> = {};
        const prevMerch: Record<string, number> = {};
        for (const t of currTxns ?? []) { if (t.txn_type === "expense" && t.merchant_id) currMerch[t.merchant_id] = (currMerch[t.merchant_id] ?? 0) + Number(t.amount); }
        for (const t of prevTxns ?? []) { if (t.txn_type === "expense" && t.merchant_id) prevMerch[t.merchant_id] = (prevMerch[t.merchant_id] ?? 0) + Number(t.amount); }
        const currTop = Object.entries(currMerch).sort((a, b) => b[1] - a[1])[0];
        const prevTop = Object.entries(prevMerch).sort((a, b) => b[1] - a[1])[0];
        if (currTop && prevTop && currTop[0] !== prevTop[0]) {
            insights.push({ title: "Top merchant changed", body: "Your biggest spending merchant changed this month.", insight_type: "top_merchant_change", data: { current: { id: currTop[0], amount: currTop[1] }, previous: { id: prevTop[0], amount: prevTop[1] } } });
        }

        // RULE 5: No income recorded
        if (totalIncome === 0 && (currTxns ?? []).length > 0) {
            insights.push({ title: "No income recorded this month", body: "You have transactions but no income entries.", insight_type: "missing_income", data: { transaction_count: (currTxns ?? []).length } });
        }

        // Idempotent write: delete old, insert new
        await admin.from("insights").delete().eq("ledger_id", ledger_id).like("data->>month", month);
        if (insights.length > 0) {
            const rows = insights.map(i => ({ ledger_id, title: i.title, body: i.body, insight_type: i.insight_type, data: { ...i.data, month }, is_read: false }));
            const { error: insErr } = await admin.from("insights").insert(rows);
            if (insErr) throw { status: 500, message: insErr.message };
        }

        return json({ success: true, month, insights_generated: insights.length, insights: insights.map(i => ({ title: i.title, type: i.insight_type })) });
    } catch (err: unknown) {
        if (err && typeof err === "object" && "status" in err) { const e = err as { status: number; message: string }; return json({ error: e.message }, e.status); }
        console.error(err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
});
