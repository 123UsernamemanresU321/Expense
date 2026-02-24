import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import { callEdgeFunction } from "@/lib/supabase/edge-functions";
import type { ExportJob } from "@/types/database";

/** Create an export job (via Edge Function) */
export async function createExport(ledgerId: string, filters?: { start_date?: string; end_date?: string }) {
    return callEdgeFunction<{
        success: boolean;
        job_id: string;
        storage_path: string;
        signed_url: string | null;
        files: string[];
        transaction_count: number;
    }>("generate-export-pack", { ledger_id: ledgerId, format: "csv", filters });
}

/** Poll export job status */
export async function getExportJob(jobId: string): Promise<ExportJob> {
    return unwrap(
        await supabase.from("export_jobs").select("*").eq("id", jobId).single()
    );
}

/** List recent export jobs */
export async function getExportHistory(ledgerId: string): Promise<ExportJob[]> {
    return unwrap(
        await supabase
            .from("export_jobs")
            .select("*")
            .eq("ledger_id", ledgerId)
            .order("created_at", { ascending: false })
            .limit(20)
    );
}

/** Get a signed download URL for an export file */
export async function getExportDownloadUrl(storagePath: string, fileName: string): Promise<string | null> {
    const { data } = await supabase.storage
        .from("exports")
        .createSignedUrl(`${storagePath}/${fileName}`, 3600);
    return data?.signedUrl ?? null;
}

/** Poll until job completes or fails (max ~60s) */
export async function pollExportJob(jobId: string, onProgress?: (job: ExportJob) => void): Promise<ExportJob> {
    let attempts = 0;
    while (attempts < 30) {
        const job = await getExportJob(jobId);
        onProgress?.(job);
        if (job.status === "completed" || job.status === "failed") return job;
        await new Promise((r) => setTimeout(r, 2000));
        attempts++;
    }
    throw new Error("Export job timed out");
}
