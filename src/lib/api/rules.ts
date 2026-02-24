import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import { callEdgeFunction } from "@/lib/supabase/edge-functions";
import type { ClassificationRule } from "@/types/database";

export async function getRules(ledgerId: string): Promise<ClassificationRule[]> {
    return unwrap(
        await supabase.from("classification_rules").select("*").eq("ledger_id", ledgerId).order("priority", { ascending: false })
    );
}

export async function createRule(data: {
    ledger_id: string;
    match_field: string;
    match_pattern: string;
    category_id?: string;
    merchant_id?: string;
    priority?: number;
}): Promise<ClassificationRule> {
    return unwrap(
        await supabase.from("classification_rules").insert(data).select().single()
    );
}

export async function updateRule(id: string, updates: Partial<Pick<ClassificationRule, "match_field" | "match_pattern" | "category_id" | "merchant_id" | "priority" | "is_active">>): Promise<ClassificationRule> {
    return unwrap(
        await supabase.from("classification_rules").update(updates).eq("id", id).select().single()
    );
}

export async function deleteRule(id: string): Promise<void> {
    unwrap(await supabase.from("classification_rules").delete().eq("id", id));
}

/** Test classification rules without applying (via Edge Function) */
export async function testRules(ledgerId: string, lookbackDays = 30) {
    return callEdgeFunction<{
        success: boolean;
        mode: "test";
        total_transactions: number;
        matched: number;
        rules_evaluated: number;
        sample: { transaction_id: string; description: string; pattern: string; new_category_id: string | null }[];
    }>("apply-classification-rules", { ledger_id: ledgerId, mode: "test", lookback_days: lookbackDays });
}

/** Apply classification rules to transactions (via Edge Function) */
export async function applyRules(ledgerId: string, lookbackDays = 30) {
    return callEdgeFunction<{
        success: boolean;
        mode: "apply";
        total_transactions: number;
        matched: number;
        applied: number;
        rules_evaluated: number;
    }>("apply-classification-rules", { ledger_id: ledgerId, mode: "apply", lookback_days: lookbackDays });
}
