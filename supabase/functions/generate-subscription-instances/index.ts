// =============================================================================
// generate-subscription-instances — Self-contained Edge Function
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
    const { data } = await admin.auth.getUser(ah.replace(/Bearer\s+/i, ""));
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

function advanceDate(date: Date, interval: string): Date {
    switch (interval) {
        case "daily": date.setUTCDate(date.getUTCDate() + 1); break;
        case "weekly": date.setUTCDate(date.getUTCDate() + 7); break;
        case "monthly": date.setUTCMonth(date.getUTCMonth() + 1); break;
        case "quarterly": date.setUTCMonth(date.getUTCMonth() + 3); break;
        case "yearly": date.setUTCFullYear(date.getUTCFullYear() + 1); break;
    }
    return date;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    try {
        const authHeader = req.headers.get("authorization");
        const { ledger_id, horizon_days } = await req.json();
        if (!ledger_id) return json({ error: "ledger_id required" }, 400);

        const days = horizon_days ?? 45;
        const admin = adminClient();
        const ctx = await requireMember(admin, authHeader, ledger_id, ["owner", "admin", "editor"]);

        const today = new Date();
        const horizon = new Date();
        horizon.setDate(horizon.getDate() + days);

        const { data: subs, error: subErr } = await admin.from("subscriptions").select("*").eq("ledger_id", ledger_id).eq("is_active", true);
        if (subErr) throw { status: 500, message: subErr.message };

        let created = 0, skipped = 0;

        for (const sub of subs ?? []) {
            let nextDue = new Date(sub.next_due_date + "T00:00:00Z");

            while (nextDue <= horizon) {
                if (nextDue < today) {
                    nextDue = advanceDate(new Date(nextDue), sub.interval);
                    continue;
                }

                const dateStr = nextDue.toISOString().slice(0, 10);
                const extId = `sub_${sub.id}_${dateStr}`;

                // Dedup check via external_id
                const { data: existing } = await admin.from("transactions").select("id").eq("external_id", extId).limit(1);

                if (existing && existing.length > 0) {
                    skipped++;
                } else {
                    const { error: insErr } = await admin.from("transactions").insert({
                        ledger_id,
                        account_id: sub.account_id,
                        category_id: sub.category_id,
                        merchant_id: sub.merchant_id,
                        txn_type: "expense",
                        amount: sub.amount,
                        currency_code: sub.currency_code,
                        date: dateStr,
                        description: `Subscription: ${sub.name}`,
                        notes: `Auto-generated from subscription ${sub.id}`,
                        external_id: extId,
                        created_by: ctx.userId,
                    });
                    if (insErr) throw { status: 500, message: insErr.message };
                    created++;
                }

                nextDue = advanceDate(new Date(nextDue), sub.interval);
            }

            // Update next_due_date
            if (nextDue > new Date(sub.next_due_date + "T00:00:00Z")) {
                await admin.from("subscriptions").update({ next_due_date: nextDue.toISOString().slice(0, 10) }).eq("id", sub.id);
            }
        }

        return json({ success: true, subscriptions_processed: (subs ?? []).length, transactions_created: created, transactions_skipped: skipped, horizon_days: days });
    } catch (err: unknown) {
        if (err && typeof err === "object" && "status" in err) { const e = err as { status: number; message: string }; return json({ error: e.message }, e.status); }
        console.error(err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
    }
});
