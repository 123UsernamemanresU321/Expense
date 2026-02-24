// =============================================================================
// ocr-job-worker — Self-contained Edge Function (Placeholder OCR Pipeline)
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
        const { ocr_job_id } = await req.json();
        if (!ocr_job_id) return json({ error: "ocr_job_id required" }, 400);

        const admin = adminClient();
        const { data: job, error: jobErr } = await admin.from("ocr_jobs")
            .select("*, attachment:attachments(storage_path, file_name, mime_type)")
            .eq("id", ocr_job_id).single();
        if (jobErr || !job) return json({ error: "OCR job not found" }, 404);

        await requireMember(admin, authHeader, job.ledger_id, ["owner", "admin", "editor"]);

        if (job.status === "completed") return json({ success: true, message: "Already completed", parsed_data: job.parsed_data });
        if (job.status === "processing") return json({ error: "Already processing" }, 409);

        await admin.from("ocr_jobs").update({ status: "processing" }).eq("id", ocr_job_id);

        try {
            const attachment = job.attachment;
            let rawText = "";
            let parsedData: Record<string, unknown> = {};

            if (attachment?.storage_path) {
                const { error: dlErr } = await admin.storage.from("attachments").download(attachment.storage_path);
                if (dlErr) throw { status: 500, message: `Cannot access attachment: ${dlErr.message}` };

                // Placeholder OCR — swap with real provider (Google Vision, AWS Textract, etc.)
                rawText = [
                    `[OCR Placeholder for: ${attachment.file_name}]`,
                    `File type: ${attachment.mime_type ?? "unknown"}`,
                    "", "--- Extracted Receipt ---",
                    "Store: Sample Merchant", "Date: 2026-02-15",
                    "Items:", "  Item 1              $12.99", "  Item 2              $8.50",
                    "  Tax                 $1.72", "  Total               $23.21",
                    "Payment: VISA ending 4242", "---",
                    "", "Note: Placeholder text. Connect a real OCR provider for actual extraction.",
                ].join("\n");

                parsedData = {
                    merchant: "Sample Merchant", date: "2026-02-15",
                    items: [{ description: "Item 1", amount: 12.99 }, { description: "Item 2", amount: 8.50 }],
                    tax: 1.72, total: 23.21, payment_method: "VISA ending 4242",
                    confidence: 0.0, provider: "placeholder",
                };
            } else {
                rawText = "No attachment found for OCR processing.";
                parsedData = { error: "no_attachment", confidence: 0.0, provider: "placeholder" };
            }

            await admin.from("ocr_jobs").update({ status: "completed", raw_text: rawText, parsed_data: parsedData }).eq("id", ocr_job_id);

            await admin.from("audit_logs").insert({
                ledger_id: job.ledger_id, table_name: "ocr_jobs", record_id: ocr_job_id,
                action: "OCR_COMPLETED", actor_id: job.created_by,
                after_data: { provider: "placeholder", has_attachment: !!attachment?.storage_path, parsed_total: parsedData.total ?? null },
            });

            return json({ success: true, ocr_job_id, status: "completed", raw_text: rawText, parsed_data: parsedData });
        } catch (err) {
            await admin.from("ocr_jobs").update({ status: "failed", error_message: err instanceof Error ? err.message : String(err) }).eq("id", ocr_job_id);
            throw err;
        }
    } catch (err: unknown) {
        if (err && typeof err === "object" && "status" in err) { const e = err as { status: number; message: string }; return json({ error: e.message }, e.status); }
        console.error(err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
});
