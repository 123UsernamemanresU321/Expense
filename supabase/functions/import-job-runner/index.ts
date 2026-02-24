// =============================================================================
// import-job-runner — Self-contained Edge Function
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

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "", inQuotes = false;
    for (const ch of line) {
        if (ch === '"') inQuotes = !inQuotes;
        else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
        else current += ch;
    }
    result.push(current);
    return result;
}

function autoMapping(headers: string[]): Record<string, string> {
    const map: Record<string, string> = {};
    const syn: Record<string, string[]> = {
        amount: ["amount", "value", "sum", "total"],
        date: ["date", "transaction_date", "txn_date", "posted_date"],
        description: ["description", "desc", "memo", "narrative", "details", "payee"],
        notes: ["notes", "note", "comment"],
        type: ["type", "txn_type", "transaction_type"],
    };
    for (const h of headers) {
        const lo = h.toLowerCase().trim();
        for (const [db, names] of Object.entries(syn)) {
            if (names.includes(lo)) { map[h] = db; break; }
        }
    }
    return map;
}

function inferType(t: string | undefined, amount: number): string {
    if (t) {
        const lo = t.toLowerCase().trim();
        if (["income", "credit", "deposit"].includes(lo)) return "income";
        if (["expense", "debit", "withdrawal", "payment"].includes(lo)) return "expense";
        if (lo === "transfer") return "transfer";
        if (lo === "refund") return "refund";
    }
    return amount >= 0 ? "expense" : "income";
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
        const authHeader = req.headers.get("authorization");
        const { import_job_id } = await req.json();
        if (!import_job_id) return json({ error: "import_job_id required" }, 400);

        const admin = adminClient();
        const { data: job, error: jobErr } = await admin.from("import_jobs").select("*").eq("id", import_job_id).single();
        if (jobErr || !job) return json({ error: "Import job not found" }, 404);

        await requireMember(admin, authHeader, job.ledger_id, ["owner", "admin", "editor"]);

        if (job.status === "completed") return json({ success: true, message: "Already completed", job });
        if (job.status === "processing") return json({ error: "Already processing" }, 409);

        await admin.from("import_jobs").update({ status: "processing" }).eq("id", import_job_id);

        try {
            const { data: fileData, error: dlErr } = await admin.storage.from("imports").download(job.storage_path);
            if (dlErr || !fileData) throw { status: 500, message: `Download failed: ${dlErr?.message}` };

            const csvText = await fileData.text();
            const lines = csvText.split("\n").filter((l: string) => l.trim());
            if (lines.length < 2) throw { status: 400, message: "CSV needs header + data rows" };

            const headers = lines[0].split(",").map((h: string) => h.trim().toLowerCase());
            const mapping = job.column_mapping ?? autoMapping(headers);
            const mappedCols = Object.values(mapping) as string[];
            if (!mappedCols.includes("amount") || !mappedCols.includes("date")) {
                await admin.from("import_jobs").update({ status: "failed", errors: [{ row: 0, error: "Missing amount/date columns" }] }).eq("id", import_job_id);
                return json({ error: "Missing required column mappings: amount, date" }, 400);
            }

            // Fetch existing external_ids for dedup
            const { data: existing } = await admin.from("transactions").select("external_id").eq("ledger_id", job.ledger_id).not("external_id", "is", null);
            const existingIds = new Set((existing ?? []).map(t => t.external_id));

            const { data: accounts } = await admin.from("accounts").select("id").eq("ledger_id", job.ledger_id).eq("is_active", true).order("sort_order").limit(1);
            const defaultAcct = accounts?.[0]?.id;
            if (!defaultAcct) throw { status: 400, message: "No active accounts" };

            let imported = 0, skipped = 0, errCount = 0;
            const errors: { row: number; error: string }[] = [];

            for (let i = 1; i < lines.length; i++) {
                try {
                    const vals = parseCSVLine(lines[i]);
                    const row: Record<string, string> = {};
                    headers.forEach((h: string, idx: number) => { row[h] = vals[idx]?.trim() ?? ""; });

                    const mapped: Record<string, string> = {};
                    for (const [csvCol, dbCol] of Object.entries(mapping)) mapped[dbCol as string] = row[csvCol as string] ?? "";

                    const amount = parseFloat(mapped.amount);
                    if (isNaN(amount)) { errors.push({ row: i + 1, error: "Invalid amount" }); errCount++; continue; }

                    const extId = `import_${import_job_id}_row${i}`;
                    if (existingIds.has(extId)) { skipped++; continue; }

                    const { error: insErr } = await admin.from("transactions").insert({
                        ledger_id: job.ledger_id, account_id: defaultAcct,
                        txn_type: inferType(mapped.type, amount), amount: Math.abs(amount),
                        date: mapped.date || new Date().toISOString().slice(0, 10),
                        description: mapped.description || mapped.memo || `Imported row ${i}`,
                        notes: mapped.notes || null, external_id: extId, created_by: job.created_by,
                    });
                    if (insErr) { errors.push({ row: i + 1, error: insErr.message }); errCount++; }
                    else imported++;
                } catch (rowErr) {
                    errors.push({ row: i + 1, error: rowErr instanceof Error ? rowErr.message : String(rowErr) });
                    errCount++;
                }
            }

            await admin.from("import_jobs").update({
                status: "completed", total_rows: lines.length - 1,
                imported_rows: imported, skipped_rows: skipped,
                error_rows: errCount, errors: errors.length > 0 ? errors.slice(0, 100) : null,
            }).eq("id", import_job_id);

            await admin.from("audit_logs").insert({
                ledger_id: job.ledger_id, table_name: "import_jobs", record_id: import_job_id,
                action: "IMPORT_COMPLETED", actor_id: job.created_by,
                after_data: { imported, skipped, errors: errCount, total: lines.length - 1 },
            });

            return json({ success: true, total_rows: lines.length - 1, imported, skipped, errors: errCount, error_details: errors.slice(0, 20) });
        } catch (err) {
            await admin.from("import_jobs").update({ status: "failed", errors: [{ row: 0, error: err instanceof Error ? err.message : String(err) }] }).eq("id", import_job_id);
            throw err;
        }
    } catch (err: unknown) {
        if (err && typeof err === "object" && "status" in err) { const e = err as { status: number; message: string }; return json({ error: e.message }, e.status); }
        console.error(err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
});
