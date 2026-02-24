import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import type { Notification } from "@/types/database";

export async function getNotifications(unreadOnly = false): Promise<Notification[]> {
    let q = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
    if (unreadOnly) q = q.eq("is_read", false);
    return unwrap(await q);
}

export async function getUnreadCount(): Promise<number> {
    const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("is_read", false);
    return count ?? 0;
}

export async function markRead(ids: string[]): Promise<void> {
    unwrap(await supabase.from("notifications").update({ is_read: true }).in("id", ids));
}

export async function markAllRead(): Promise<void> {
    unwrap(
        await supabase.from("notifications").update({ is_read: true }).eq("is_read", false)
    );
}

export async function dismiss(id: string): Promise<void> {
    unwrap(
        await supabase.from("notifications").update({ dismissed_at: new Date().toISOString() }).eq("id", id)
    );
}
