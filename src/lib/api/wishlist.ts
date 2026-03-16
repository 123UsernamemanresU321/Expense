import { supabase } from "../supabase/client";

export interface WishlistItem {
    id: string;
    ledger_id: string;
    name: string;
    cost: number;
    discount: number;
    currency_code: string;
    is_selected: boolean;
    created_at: string;
    updated_at: string;
}

export async function getWishlistItems(ledgerId: string): Promise<WishlistItem[]> {
    const { data, error } = await supabase
        .from("wishlist_items")
        .select("*")
        .eq("ledger_id", ledgerId)
        .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
}

export async function createWishlistItem(ledgerId: string, item: Omit<WishlistItem, "id" | "ledger_id" | "created_at" | "updated_at">): Promise<WishlistItem> {
    const { data, error } = await supabase
        .from("wishlist_items")
        .insert({
            ledger_id: ledgerId,
            ...item
        })
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function toggleWishlistItemSelection(id: string, isSelected: boolean): Promise<void> {
    const { error } = await supabase
        .from("wishlist_items")
        .update({ is_selected: isSelected })
        .eq("id", id);

    if (error) throw error;
}

export async function deleteWishlistItem(id: string): Promise<void> {
    const { error } = await supabase
        .from("wishlist_items")
        .delete()
        .eq("id", id);

    if (error) throw error;
}
