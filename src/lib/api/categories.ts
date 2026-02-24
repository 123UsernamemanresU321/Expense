import { supabase } from "@/lib/supabase/client";
import { unwrap } from "@/lib/errors";
import type { Category } from "@/types/database";

export async function getCategories(ledgerId: string): Promise<Category[]> {
    return unwrap(
        await supabase
            .from("categories")
            .select("*")
            .eq("ledger_id", ledgerId)
            .order("sort_order")
    );
}

/** Returns categories as a tree with children[] */
export async function getCategoryTree(ledgerId: string): Promise<Category[]> {
    const flat = await getCategories(ledgerId);
    const map = new Map<string, Category>();
    const roots: Category[] = [];

    for (const cat of flat) {
        map.set(cat.id, { ...cat, children: [] });
    }

    for (const cat of flat) {
        const node = map.get(cat.id)!;
        if (cat.parent_id && map.has(cat.parent_id)) {
            map.get(cat.parent_id)!.children!.push(node);
        } else {
            roots.push(node);
        }
    }

    return roots;
}

export async function createCategory(data: {
    ledger_id: string;
    name: string;
    parent_id?: string;
    icon?: string;
    color?: string;
    is_income?: boolean;
    sort_order?: number;
}): Promise<Category> {
    return unwrap(
        await supabase.from("categories").insert(data).select().single()
    );
}

export async function updateCategory(id: string, updates: Partial<Pick<Category, "name" | "icon" | "color" | "is_income" | "is_active" | "sort_order" | "parent_id">>): Promise<Category> {
    return unwrap(
        await supabase.from("categories").update(updates).eq("id", id).select().single()
    );
}

export async function deleteCategory(id: string): Promise<void> {
    // Soft delete by deactivating
    unwrap(
        await supabase.from("categories").update({ is_active: false }).eq("id", id)
    );
}
