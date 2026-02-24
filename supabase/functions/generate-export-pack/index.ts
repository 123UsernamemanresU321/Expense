// =============================================================================
// generate-export-pack — Self-contained Edge Function
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

function csvEscape(val: string): string {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) return `"${val.replace(/"/g, '""')}"`;
    return val;
}

// deno-lint-ignore no-explicit-any
function generateCSV(rows: any[], columns: string[], computed?: Record<string, (r: any) => string>): string {
    const allCols = [...columns, ...Object.keys(computed ?? {})];
    const header = allCols.join(",");
    const lines = rows.map(row => allCols.map(col => {
        if (computed && col in computed) return csvEscape(computed[col](row));
        const val = row[col];
        return csvEscape(val == null ? "" : String(val));
    }).join(","));
    return [header, ...lines].join("\n");
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
        const authHeader = req.headers.get("authorization");
        const { ledger_id, format, filters } = await req.json();
        if (!ledger_id) return json({ error: "ledger_id required" }, 400);

        const admin = adminClient();
        const ctx = await requireMember(admin, authHeader, ledger_id);
        const dateFilter = filters ?? {};

        const { data: job, error: jobErr } = await admin.from("export_jobs").insert({
            ledger_id, format: format ?? "csv", filters: dateFilter, status: "processing", created_by: ctx.userId,
        }).select().single();
        if (jobErr || !job) throw { status: 500, message: jobErr?.message ?? "Failed to create job" };

        try {
            let txnQuery = admin.from("transactions")
                .select("*, category:categories(name), merchant:merchants(name), account:accounts(name)")
                .eq("ledger_id", ledger_id).order("date", { ascending: false });
            if (dateFilter.start_date) txnQuery = txnQuery.gte("date", dateFilter.start_date);
            if (dateFilter.end_date) txnQuery = txnQuery.lte("date", dateFilter.end_date);
            const { data: transactions } = await txnQuery;

            const { data: budgets } = await admin.from("budgets").select("*").eq("ledger_id", ledger_id);
            const { data: categories } = await admin.from("categories").select("*").eq("ledger_id", ledger_id);
            const { data: summaries } = await admin.from("monthly_summaries").select("*").eq("ledger_id", ledger_id).order("year_month", { ascending: false });

            const storagePath = `exports/${ledger_id}/${job.id}`;

            // 1. transactions.csv
            const txnCsv = generateCSV(transactions ?? [], ["date", "txn_type", "amount", "currency_code", "description", "notes", "is_split", "is_reconciled"], {
                category_name: r => r.category?.name ?? "",
                merchant_name: r => r.merchant?.name ?? "",
                account_name: r => r.account?.name ?? "",
            });
            await admin.storage.from("exports").upload(`${storagePath}/transactions.csv`, new Blob([txnCsv], { type: "text/csv" }), { upsert: true });

            // 2. budgets.csv
            const budgetCsv = generateCSV(budgets ?? [], ["name", "amount", "period", "start_date", "end_date", "is_active"]);
            await admin.storage.from("exports").upload(`${storagePath}/budgets.csv`, new Blob([budgetCsv], { type: "text/csv" }), { upsert: true });

            // 3. categories.json
            await admin.storage.from("exports").upload(`${storagePath}/categories.json`, new Blob([JSON.stringify(categories ?? [], null, 2)], { type: "application/json" }), { upsert: true });

            // 4. summary.json
            const summaryData = {
                exported_at: new Date().toISOString(), ledger_id, filters: dateFilter,
                transaction_count: (transactions ?? []).length, budget_count: (budgets ?? []).length,
                category_count: (categories ?? []).length, monthly_summaries: summaries ?? [],
            };
            await admin.storage.from("exports").upload(`${storagePath}/summary.json`, new Blob([JSON.stringify(summaryData, null, 2)], { type: "application/json" }), { upsert: true });

            const { data: signedUrl } = await admin.storage.from("exports").createSignedUrl(`${storagePath}/transactions.csv`, 3600);

            await admin.from("export_jobs").update({ status: "completed", storage_path: storagePath }).eq("id", job.id);
            await admin.from("audit_logs").insert({
                ledger_id, table_name: "export_jobs", record_id: job.id, action: "EXPORT_COMPLETED", actor_id: ctx.userId,
                after_data: { format: format ?? "csv", files: 4, transaction_count: (transactions ?? []).length },
            });

            return json({ success: true, job_id: job.id, storage_path: storagePath, signed_url: signedUrl?.signedUrl ?? null, files: ["transactions.csv", "budgets.csv", "categories.json", "summary.json"], transaction_count: (transactions ?? []).length });
        } catch (err) {
            await admin.from("export_jobs").update({ status: "failed", error_message: err instanceof Error ? err.message : String(err) }).eq("id", job.id);
            throw err;
        }
    } catch (err: unknown) {
        if (err && typeof err === "object" && "status" in err) { const e = err as { status: number; message: string }; return json({ error: e.message }, e.status); }
        console.error(err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
});
