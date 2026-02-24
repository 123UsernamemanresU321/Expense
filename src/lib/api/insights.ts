import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import { callEdgeFunction } from "@/lib/supabase/edge-functions";
import type { Insight, MonthlySummary } from "@/types/database";

/** Fetch insights for a ledger */
export async function getInsights(ledgerId: string, onlyUnread = false): Promise<Insight[]> {
    let q = supabase.from("insights").select("*").eq("ledger_id", ledgerId).order("created_at", { ascending: false });
    if (onlyUnread) q = q.eq("is_read", false);
    return unwrap(await q);
}

/** Mark insight(s) as read */
export async function markInsightsRead(ids: string[]): Promise<void> {
    unwrap(await supabase.from("insights").update({ is_read: true }).in("id", ids));
}

/** Generate insights for a month (via Edge Function) */
export async function generateInsights(ledgerId: string, month: string) {
    return callEdgeFunction<{
        success: boolean;
        month: string;
        insights_generated: number;
        insights: { title: string; type: string }[];
    }>("generate-insights", { ledger_id: ledgerId, month });
}

/** Aggregate monthly summaries (via Edge Function) */
export async function aggregateSummaries(ledgerId: string, month: string, backfillMonths = 0) {
    return callEdgeFunction<{
        success: boolean;
        months_processed: number;
        summaries: {
            year_month: string;
            total_income: number;
            total_expense: number;
            total_transfers: number;
            net_savings: number;
            transaction_count: number;
        }[];
    }>("aggregate-monthly-summaries", { ledger_id: ledgerId, month, backfill_months: backfillMonths });
}

/** Get monthly summaries (direct query) */
export async function getMonthlySummaries(ledgerId: string, limit = 12): Promise<MonthlySummary[]> {
    return unwrap(
        await supabase
            .from("monthly_summaries")
            .select("*")
            .eq("ledger_id", ledgerId)
            .order("year_month", { ascending: false })
            .limit(limit)
    );
}
