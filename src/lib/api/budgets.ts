import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import type { Budget, BudgetAlert, BudgetPeriod } from "@/types/database";
import { batchConvert, getCurrencyInfo } from "@/lib/api/exchange-rates";

export async function getBudgets(ledgerId: string): Promise<Budget[]> {
    return unwrap(
        await supabase
            .from("budgets")
            .select("*, alerts:budget_alerts(*), category:categories(name)")
            .eq("ledger_id", ledgerId)
            .order("name")
    );
}

export async function createBudget(data: {
    ledger_id: string;
    category_id?: string;
    name: string;
    amount: number;
    period: BudgetPeriod;
    start_date: string;
    end_date?: string;
    alert_thresholds?: number[];
}): Promise<Budget> {
    const { alert_thresholds, ...budgetData } = data;
    const budget: Budget = unwrap(
        await supabase.from("budgets").insert(budgetData).select().single()
    );

    if (alert_thresholds && alert_thresholds.length > 0) {
        await supabase.from("budget_alerts").insert(
            alert_thresholds.map((pct) => ({ budget_id: budget.id, threshold_pct: pct }))
        );
    }

    return budget;
}

export async function updateBudget(id: string, updates: Partial<Pick<Budget, "name" | "amount" | "period" | "start_date" | "end_date" | "is_active" | "category_id">>): Promise<Budget> {
    return unwrap(
        await supabase.from("budgets").update(updates).eq("id", id).select().single()
    );
}

export async function deleteBudget(id: string): Promise<void> {
    unwrap(await supabase.from("budgets").update({ is_active: false }).eq("id", id));
}

export async function updateAlertThresholds(budgetId: string, thresholds: number[]): Promise<BudgetAlert[]> {
    // Delete existing
    await supabase.from("budget_alerts").delete().eq("budget_id", budgetId);
    // Insert new
    if (thresholds.length === 0) return [];
    return unwrap(
        await supabase.from("budget_alerts").insert(
            thresholds.map((pct) => ({ budget_id: budgetId, threshold_pct: pct }))
        ).select()
    );
}

/** Compute spent amount for a budget by summing matching transactions */
export async function getBudgetSpent(budget: Budget): Promise<number> {
    const now = new Date();
    let startDate = budget.start_date;

    // For monthly budgets, use current month start
    if (budget.period === "monthly") {
        startDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }

    let q = supabase
        .from("transactions")
        .select("amount, currency_code, ledgers(currency_code)")
        .eq("ledger_id", budget.ledger_id)
        .eq("txn_type", "expense")
        .gte("date", startDate);

    if (budget.end_date) q = q.lte("date", budget.end_date);
    if (budget.category_id) q = q.eq("category_id", budget.category_id);

    const txns = unwrap(await q) as any[];
    if (txns.length === 0) return 0;

    const mainCurrency = txns[0]?.ledgers?.currency_code || "USD";
    const items = txns.map((t) => ({ amount: Number(t.amount), currency: t.currency_code || mainCurrency }));

    const converted = await batchConvert(items, mainCurrency);
    return converted.reduce((sum, v) => sum + v, 0);
}
