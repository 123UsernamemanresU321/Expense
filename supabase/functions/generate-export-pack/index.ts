// =============================================================================
// generate-export-pack — Self-contained Edge Function
// Paste this ENTIRE file into the Supabase Dashboard Edge Functions editor
// =============================================================================
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-user-jwt",
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
async function getUid(_admin: SupabaseClient, ah: string | null): Promise<string | null> {
    if (!ah) {
        console.error("[getUid] No token provided in request.");
        return null;
    }
    const token = ah.replace(/Bearer\s+/i, "");
    if (!token || token.split(".").length !== 3) {
        console.error("[getUid] Token is malformed. Parts:", token.split(".").length);
        return null;
    }
    try {
        const payloadStr = atob(token.split(".")[1]);
        const payload = JSON.parse(payloadStr);
        console.log("[getUid] Decoded sub:", payload.sub);
        return payload.sub ?? null;
    } catch (err) {
        console.error("[getUid] Failed to decode JWT:", err);
        return null;
    }
}
async function requireMember(admin: SupabaseClient, ah: string | null, lid: string, roles?: string[]) {
    const uid = await getUid(admin, ah);
    if (!uid) throw { status: 401, message: "Unauthorized" };
    const { data: m } = await admin.from("ledger_members").select("role").eq("ledger_id", lid).eq("user_id", uid).single();
    if (!m) throw { status: 403, message: "Not a member" };
    if (roles && !roles.includes(m.role)) throw { status: 403, message: `Requires: ${roles.join("|")}` };
    return { userId: uid, role: m.role };
}

// ---------------------------------------------------------------------------
// CSV helpers — UTF-8 BOM for Excel/Numbers multi-language support
// ---------------------------------------------------------------------------
const BOM = "\uFEFF";

function csvEscape(val: string): string {
    if (val.includes(",") || val.includes('"') || val.includes("\n") || val.includes("\r")) {
        return `"${val.replace(/"/g, '""')}"`;
    }
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
    return BOM + [header, ...lines].join("\n");
}

function uploadCSV(admin: SupabaseClient, path: string, csv: string) {
    return admin.storage.from("exports").upload(path, new Blob([csv], { type: "text/csv; charset=utf-8" }), { upsert: true });
}

function uploadJSON(admin: SupabaseClient, path: string, data: unknown) {
    return admin.storage.from("exports").upload(path, new Blob([JSON.stringify(data, null, 2)], { type: "application/json; charset=utf-8" }), { upsert: true });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
        const body = await req.json();
        const { ledger_id, format, filters, _user_jwt } = body;
        const authHeader = _user_jwt
            || req.headers.get("x-user-jwt")
            || req.headers.get("authorization");
        console.log("[export] Token sources — _user_jwt:", !!_user_jwt, "x-user-jwt header:", !!req.headers.get("x-user-jwt"), "authorization header:", !!req.headers.get("authorization"));
        if (!ledger_id) return json({ error: "ledger_id required" }, 400);

        const admin = adminClient();
        const ctx = await requireMember(admin, authHeader, ledger_id);
        const dateFilter = filters ?? {};

        const { data: job, error: jobErr } = await admin.from("export_jobs").insert({
            ledger_id, format: format ?? "csv", filters: dateFilter, status: "processing", created_by: ctx.userId,
        }).select().single();
        if (jobErr || !job) throw { status: 500, message: jobErr?.message ?? "Failed to create job" };

        try {
            // =================================================================
            // Fetch all data
            // =================================================================
            const { data: ledger } = await admin.from("ledgers").select("*").eq("id", ledger_id).single();

            const { data: accounts } = await admin.from("accounts").select("*").eq("ledger_id", ledger_id).order("sort_order");

            const { data: categories } = await admin.from("categories").select("*").eq("ledger_id", ledger_id).order("sort_order");

            const { data: merchants } = await admin.from("merchants")
                .select("*, default_category:categories(name)").eq("ledger_id", ledger_id).order("name");

            const { data: tags } = await admin.from("tags").select("*").eq("ledger_id", ledger_id).order("name");

            let txnQuery = admin.from("transactions")
                .select("*, category:categories(name), merchant:merchants(name), account:accounts(name)")
                .eq("ledger_id", ledger_id).order("date", { ascending: false });
            if (dateFilter.start_date) txnQuery = txnQuery.gte("date", dateFilter.start_date);
            if (dateFilter.end_date) txnQuery = txnQuery.lte("date", dateFilter.end_date);
            const { data: transactions } = await txnQuery;

            // Fetch tags per transaction
            const txnIds = (transactions ?? []).map(t => t.id);
            let txnTagMap: Record<string, string[]> = {};
            if (txnIds.length > 0) {
                const { data: txnTags } = await admin.from("transaction_tags")
                    .select("transaction_id, tag:tags(name)")
                    .in("transaction_id", txnIds);
                txnTagMap = {};
                // deno-lint-ignore no-explicit-any
                (txnTags ?? []).forEach((tt: any) => {
                    if (!txnTagMap[tt.transaction_id]) txnTagMap[tt.transaction_id] = [];
                    txnTagMap[tt.transaction_id].push(tt.tag?.name ?? "");
                });
            }

            const { data: budgets } = await admin.from("budgets")
                .select("*, category:categories(name)").eq("ledger_id", ledger_id);

            const { data: subscriptions } = await admin.from("subscriptions")
                .select("*, account:accounts(name), category:categories(name), merchant:merchants(name)")
                .eq("ledger_id", ledger_id);

            const { data: rules } = await admin.from("classification_rules")
                .select("*, category:categories(name), merchant:merchants(name)")
                .eq("ledger_id", ledger_id).order("priority", { ascending: false });

            const { data: wishlistItems } = await admin.from("wishlist_items")
                .select("*").eq("ledger_id", ledger_id).order("created_at");

            const { data: summaries } = await admin.from("monthly_summaries")
                .select("*").eq("ledger_id", ledger_id).order("year_month", { ascending: false });

            // Build a category name map (id → full path name)
            const catMap: Record<string, string> = {};
            (categories ?? []).forEach(c => { catMap[c.id] = c.name; });
            // Resolve parent names for subcategories
            (categories ?? []).forEach(c => {
                if (c.parent_id && catMap[c.parent_id]) {
                    catMap[c.id] = `${catMap[c.parent_id]} > ${c.name}`;
                }
            });

            const storagePath = `exports/${ledger_id}/${job.id}`;
            const fileStats: Record<string, number> = {};

            // =================================================================
            // 1. accounts.csv
            // =================================================================
            const accountsCsv = generateCSV(accounts ?? [], [
                "name", "account_type", "currency_code", "balance", "institution", "note", "is_active", "sort_order"
            ]);
            await uploadCSV(admin, `${storagePath}/accounts.csv`, accountsCsv);
            fileStats["accounts.csv"] = (accounts ?? []).length;

            // =================================================================
            // 2. categories.csv
            // =================================================================
            const categoriesCsv = generateCSV(categories ?? [], [
                "name", "icon", "color", "is_income", "sort_order"
            ], {
                parent_name: r => r.parent_id ? (catMap[r.parent_id] ?? "") : "",
            });
            await uploadCSV(admin, `${storagePath}/categories.csv`, categoriesCsv);
            fileStats["categories.csv"] = (categories ?? []).length;

            // =================================================================
            // 3. merchants.csv
            // =================================================================
            const merchantsCsv = generateCSV(merchants ?? [], [
                "name", "website", "notes"
            ], {
                default_category: r => r.default_category?.name ?? "",
            });
            await uploadCSV(admin, `${storagePath}/merchants.csv`, merchantsCsv);
            fileStats["merchants.csv"] = (merchants ?? []).length;

            // =================================================================
            // 4. tags.csv
            // =================================================================
            const tagsCsv = generateCSV(tags ?? [], ["name", "color"]);
            await uploadCSV(admin, `${storagePath}/tags.csv`, tagsCsv);
            fileStats["tags.csv"] = (tags ?? []).length;

            // =================================================================
            // 5. transactions.csv (main export)
            // =================================================================
            const txnCsv = generateCSV(transactions ?? [], [
                "date", "txn_type", "amount", "currency_code", "description", "notes", "is_reconciled"
            ], {
                category: r => r.category?.name ?? "",
                merchant: r => r.merchant?.name ?? "",
                account: r => r.account?.name ?? "",
                tags: r => (txnTagMap[r.id] ?? []).join("; "),
            });
            await uploadCSV(admin, `${storagePath}/transactions.csv`, txnCsv);
            fileStats["transactions.csv"] = (transactions ?? []).length;

            // =================================================================
            // 6. budgets.csv
            // =================================================================
            const budgetsCsv = generateCSV(budgets ?? [], [
                "name", "amount", "period", "start_date", "end_date", "is_active"
            ], {
                category: r => r.category?.name ?? "",
            });
            await uploadCSV(admin, `${storagePath}/budgets.csv`, budgetsCsv);
            fileStats["budgets.csv"] = (budgets ?? []).length;

            // =================================================================
            // 7. subscriptions.csv
            // =================================================================
            const subsCsv = generateCSV(subscriptions ?? [], [
                "name", "amount", "currency_code", "interval", "next_due_date", "is_active", "auto_create_txn", "notes"
            ], {
                account: r => r.account?.name ?? "",
                category: r => r.category?.name ?? "",
                merchant: r => r.merchant?.name ?? "",
            });
            await uploadCSV(admin, `${storagePath}/subscriptions.csv`, subsCsv);
            fileStats["subscriptions.csv"] = (subscriptions ?? []).length;

            // =================================================================
            // 8. classification_rules.csv
            // =================================================================
            const rulesCsv = generateCSV(rules ?? [], [
                "match_field", "match_pattern", "priority", "is_active"
            ], {
                category: r => r.category?.name ?? "",
                merchant: r => r.merchant?.name ?? "",
            });
            await uploadCSV(admin, `${storagePath}/classification_rules.csv`, rulesCsv);
            fileStats["classification_rules.csv"] = (rules ?? []).length;

            // =================================================================
            // 9. wishlist.csv
            // =================================================================
            const wishCsv = generateCSV(wishlistItems ?? [], [
                "name", "cost", "discount", "currency_code", "is_selected"
            ]);
            await uploadCSV(admin, `${storagePath}/wishlist.csv`, wishCsv);
            fileStats["wishlist.csv"] = (wishlistItems ?? []).length;

            // =================================================================
            // 10. ledger_export.json (manifest)
            // =================================================================
            const manifest = {
                exported_at: new Date().toISOString(),
                export_version: "2.0",
                ledger: {
                    id: ledger?.id,
                    name: ledger?.name,
                    description: ledger?.description ?? "",
                    currency_code: ledger?.currency_code,
                    monthly_income: ledger?.monthly_income ?? 0,
                    monthly_income_currency: ledger?.monthly_income_currency ?? ledger?.currency_code,
                },
                filters: dateFilter,
                files: fileStats,
                monthly_summaries: summaries ?? [],
            };
            await uploadJSON(admin, `${storagePath}/ledger_export.json`, manifest);

            // =================================================================
            // Generate signed URLs for all files
            // =================================================================
            const allFiles = [...Object.keys(fileStats), "ledger_export.json"];
            const signedUrls: Record<string, string | null> = {};
            for (const file of allFiles) {
                const { data: s } = await admin.storage.from("exports").createSignedUrl(`${storagePath}/${file}`, 3600);
                signedUrls[file] = s?.signedUrl ?? null;
            }

            await admin.from("export_jobs").update({ status: "completed", storage_path: storagePath }).eq("id", job.id);
            await admin.from("audit_logs").insert({
                ledger_id, table_name: "export_jobs", record_id: job.id, action: "EXPORT_COMPLETED", actor_id: ctx.userId,
                after_data: { format: format ?? "csv", files: allFiles.length, transaction_count: (transactions ?? []).length },
            });

            return json({
                success: true,
                job_id: job.id,
                storage_path: storagePath,
                files: allFiles,
                file_stats: fileStats,
                signed_urls: signedUrls,
                transaction_count: (transactions ?? []).length,
            });
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
