import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import { callEdgeFunction } from "@/lib/supabase/edge-functions";
import type { ImportJob } from "@/types/database";

/** Upload CSV to Storage and create import job */
export async function uploadAndCreateJob(
    ledgerId: string,
    file: File,
    columnMapping?: Record<string, string>
): Promise<ImportJob> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const storagePath = `${ledgerId}/${Date.now()}_${file.name}`;

    // Upload to Storage
    const { error: uploadErr } = await supabase.storage
        .from("imports")
        .upload(storagePath, file, { contentType: "text/csv" });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    // Create import job row
    return unwrap(
        await supabase
            .from("import_jobs")
            .insert({
                ledger_id: ledgerId,
                storage_path: storagePath,
                file_name: file.name,
                status: "pending",
                column_mapping: columnMapping ?? null,
                created_by: user.id,
            })
            .select()
            .single()
    );
}

/** Start processing an import job (via Edge Function) */
export async function processImportJob(importJobId: string) {
    return callEdgeFunction<{
        success: boolean;
        total_rows: number;
        imported: number;
        skipped: number;
        errors: number;
        error_details: { row: number; error: string }[];
    }>("import-job-runner", { import_job_id: importJobId });
}

/** Get import job status */
export async function getImportJob(jobId: string): Promise<ImportJob> {
    return unwrap(
        await supabase.from("import_jobs").select("*").eq("id", jobId).single()
    );
}

/** List recent import jobs */
export async function getImportHistory(ledgerId: string): Promise<ImportJob[]> {
    return unwrap(
        await supabase
            .from("import_jobs")
            .select("*")
            .eq("ledger_id", ledgerId)
            .order("created_at", { ascending: false })
            .limit(20)
    );
}

/** Poll until import completes or fails */
export async function pollImportJob(jobId: string, onProgress?: (job: ImportJob) => void): Promise<ImportJob> {
    let attempts = 0;
    while (attempts < 30) {
        const job = await getImportJob(jobId);
        onProgress?.(job);
        if (job.status === "completed" || job.status === "failed") return job;
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
    }
    throw new Error("Import job timed out");
}
