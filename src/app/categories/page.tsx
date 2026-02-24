"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Button, Input, Modal, Badge } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { getCategoryTree, createCategory, updateCategory, deleteCategory } from "@/lib/api/categories";
import { toast } from "@/lib/errors";
import type { Category } from "@/types/database";

export default function CategoriesPage() {
    const { ledger, canWrite } = useAuth();
    const [loading, setLoading] = useState(true);
    const [tree, setTree] = useState<Category[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [newCat, setNewCat] = useState({ name: "", is_income: false, color: "#10b981", parent_id: "" });

    const load = async () => {
        if (!ledger) return;
        setLoading(true);
        const t = await getCategoryTree(ledger.id).catch(() => []);
        setTree(t);
        setLoading(false);
    };

    useEffect(() => { load(); }, [ledger]);

    const handleCreate = async () => {
        if (!ledger || !newCat.name) return;
        await createCategory({
            ledger_id: ledger.id,
            name: newCat.name,
            is_income: newCat.is_income,
            color: newCat.color,
            parent_id: newCat.parent_id || undefined,
        });
        toast("Category created!", "success");
        setShowCreate(false);
        setNewCat({ name: "", is_income: false, color: "#10b981", parent_id: "" });
        load();
    };

    const handleToggle = async (cat: Category) => {
        await updateCategory(cat.id, { is_active: !cat.is_active });
        toast(cat.is_active ? "Category deactivated" : "Category reactivated", "info");
        load();
    };

    const flatCats = tree.flatMap((c) => [c, ...(c.children ?? [])]);

    return (
        <AppShell>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Categories</h1>
                    <p className="text-sm text-zinc-400">Organize your transactions</p>
                </div>
                {canWrite && <Button onClick={() => setShowCreate(true)}>+ New Category</Button>}
            </div>

            {loading ? <TableSkeleton rows={6} /> : tree.length === 0 ? (
                <EmptyState icon="📁" title="No categories yet" description="Create categories to organize your transactions." />
            ) : (
                <div className="space-y-2">
                    {tree.map((cat) => (
                        <div key={cat.id}>
                            <CategoryRow cat={cat} depth={0} canWrite={canWrite} onToggle={handleToggle} />
                            {cat.children?.map((child) => (
                                <CategoryRow key={child.id} cat={child} depth={1} canWrite={canWrite} onToggle={handleToggle} />
                            ))}
                        </div>
                    ))}
                </div>
            )}

            <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Category">
                <div className="space-y-4">
                    <Input id="cat-name" label="Name" value={newCat.name} onChange={(e) => setNewCat({ ...newCat, name: e.target.value })} placeholder="e.g. Groceries" />
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-zinc-300">
                            <input type="checkbox" checked={newCat.is_income} onChange={(e) => setNewCat({ ...newCat, is_income: e.target.checked })} className="rounded border-zinc-600 bg-zinc-800 text-emerald-500" />
                            Income category
                        </label>
                    </div>
                    <Input id="cat-color" label="Color" type="color" value={newCat.color} onChange={(e) => setNewCat({ ...newCat, color: e.target.value })} />
                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleCreate}>Create</Button>
                        <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
                    </div>
                </div>
            </Modal>
        </AppShell>
    );
}

function CategoryRow({ cat, depth, canWrite, onToggle }: { cat: Category; depth: number; canWrite: boolean; onToggle: (c: Category) => void }) {
    return (
        <div className={`flex items-center justify-between rounded-xl bg-zinc-900/50 px-4 py-3 ${depth > 0 ? "ml-8 border-l-2 border-zinc-800" : "border border-zinc-800"}`}>
            <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color ?? "#71717a" }} />
                <span className="text-sm font-medium text-white">{cat.name}</span>
                {cat.is_income && <Badge color="emerald">Income</Badge>}
                {!cat.is_active && <Badge color="zinc">Inactive</Badge>}
            </div>
            {canWrite && (
                <Button variant="ghost" size="sm" onClick={() => onToggle(cat)}>
                    {cat.is_active ? "Deactivate" : "Activate"}
                </Button>
            )}
        </div>
    );
}
