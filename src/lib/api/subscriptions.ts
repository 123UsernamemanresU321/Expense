import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import { callEdgeFunction } from "@/lib/supabase/edge-functions";
import type { Subscription, SubInterval } from "@/types/database";

export async function getSubscriptions(ledgerId: string): Promise<Subscription[]> {
    return unwrap(
        await supabase.from("subscriptions").select("*").eq("ledger_id", ledgerId).order("next_due_date")
    );
}

export async function createSubscription(data: {
    ledger_id: string;
    account_id: string;
    category_id?: string;
    merchant_id?: string;
    name: string;
    amount: number;
    interval: SubInterval;
    next_due_date: string;
    notes?: string;
}): Promise<Subscription> {
    return unwrap(
        await supabase.from("subscriptions").insert(data).select().single()
    );
}

export async function updateSubscription(id: string, updates: Partial<Pick<Subscription, "name" | "amount" | "interval" | "next_due_date" | "is_active" | "account_id" | "category_id" | "notes">>): Promise<Subscription> {
    return unwrap(
        await supabase.from("subscriptions").update(updates).eq("id", id).select().single()
    );
}

export async function cancelSubscription(id: string): Promise<void> {
    unwrap(await supabase.from("subscriptions").update({ is_active: false }).eq("id", id));
}

/** Generate future transactions for active subscriptions (via Edge Function) */
export async function generateInstances(ledgerId: string, horizonDays = 45) {
    return callEdgeFunction<{
        success: boolean;
        subscriptions_processed: number;
        transactions_created: number;
        transactions_skipped: number;
    }>("generate-subscription-instances", { ledger_id: ledgerId, horizon_days: horizonDays });
}
