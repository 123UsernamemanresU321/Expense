import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import type { Ledger, LedgerMember, LedgerRole, MonthClosure } from "@/types/database";

// --- Ledgers ---

export async function getLedgers(): Promise<Ledger[]> {
    return unwrap(
        await supabase.from("ledgers").select("*").eq("is_active", true).order("name")
    );
}

export async function createLedger(data: {
    name: string;
    description?: string;
    currency_code?: string;
}): Promise<Ledger> {
    const { data: { user } } = await supabase.auth.getUser();
    const ledger: Ledger = unwrap(
        await supabase.from("ledgers").insert({
            name: data.name,
            description: data.description ?? null,
            currency_code: data.currency_code ?? "USD",
            created_by: user!.id,
        }).select().single()
    );

    // Auto-add creator as owner
    await supabase.from("ledger_members").insert({
        ledger_id: ledger.id,
        user_id: user!.id,
        role: "owner",
    });

    return ledger;
}

export async function updateLedger(id: string, updates: Partial<Pick<Ledger, "name" | "description" | "currency_code" | "is_active">>): Promise<Ledger> {
    return unwrap(
        await supabase.from("ledgers").update(updates).eq("id", id).select().single()
    );
}

// --- Members ---

export async function getMembers(ledgerId: string): Promise<(LedgerMember & { profile?: { display_name: string; email: string } })[]> {
    return unwrap(
        await supabase
            .from("ledger_members")
            .select("*, profile:profiles(display_name, email)")
            .eq("ledger_id", ledgerId)
            .order("created_at")
    );
}

export async function inviteMember(ledgerId: string, userId: string, role: LedgerRole): Promise<LedgerMember> {
    const { data: { user } } = await supabase.auth.getUser();
    return unwrap(
        await supabase.from("ledger_members").insert({
            ledger_id: ledgerId,
            user_id: userId,
            role,
            invited_by: user!.id,
        }).select().single()
    );
}

export async function updateMemberRole(memberId: string, role: LedgerRole): Promise<LedgerMember> {
    return unwrap(
        await supabase.from("ledger_members").update({ role }).eq("id", memberId).select().single()
    );
}

export async function removeMember(memberId: string): Promise<void> {
    unwrap(await supabase.from("ledger_members").delete().eq("id", memberId));
}

// --- Month Closures ---

export async function getMonthClosures(ledgerId: string): Promise<MonthClosure[]> {
    return unwrap(
        await supabase.from("month_closures").select("*").eq("ledger_id", ledgerId).order("year_month", { ascending: false })
    );
}

export async function closeMonth(ledgerId: string, yearMonth: string, notes?: string): Promise<MonthClosure> {
    const { data: { user } } = await supabase.auth.getUser();
    return unwrap(
        await supabase.from("month_closures").insert({
            ledger_id: ledgerId,
            year_month: yearMonth,
            closed_by: user!.id,
            notes: notes ?? null,
        }).select().single()
    );
}

export async function reopenMonth(ledgerId: string, yearMonth: string): Promise<void> {
    unwrap(
        await supabase.from("month_closures").delete().eq("ledger_id", ledgerId).eq("year_month", yearMonth)
    );
}
