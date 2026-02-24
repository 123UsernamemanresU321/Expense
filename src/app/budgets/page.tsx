"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, CardSkeleton } from "@/components/ui/empty-state";
import { Button, Input, Select, Modal, Badge } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { currencyFormatter } from "@/lib/format";
import { getBudgets, createBudget, updateBudget, deleteBudget, getBudgetSpent } from "@/lib/api/budgets";
import { getCategories } from "@/lib/api/categories";
import { toast } from "@/lib/errors";
import type { Budget, BudgetPeriod, Category } from "@/types/database";

export default function BudgetsPage() {
    const { ledger, canWrite } = useAuth();
    const [loading, setLoading] = useState(true);
    const [budgets, setBudgets] = useState<{ budget: Budget; spent: number }[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [form, setForm] = useState({ name: "", amount: "", period: "monthly" as BudgetPeriod, category_id: "", start_date: new Date().toISOString().slice(0, 10) });

    const load = async () => {
        if (!ledger) return;
        setLoading(true);
        const [bList, cats] = await Promise.all([
            getBudgets(ledger.id).catch(() => []),
            getCategories(ledger.id).catch(() => []),
        ]);
        setCategories(cats);
        const spents = await Promise.all(bList.map(async (b) => ({ budget: b, spent: await getBudgetSpent(b).catch(() => 0) })));
        setBudgets(spents);
        setLoading(false);
    };

    useEffect(() => { load(); }, [ledger]);

    const handleCreate = async () => {
        if (!ledger || !form.name || !form.amount) return;
        await createBudget({ ledger_id: ledger.id, name: form.name, amount: parseFloat(form.amount), period: form.period, start_date: form.start_date, category_id: form.category_id || undefined, alert_thresholds: [75, 90, 100] });
        toast("Budget created!", "success");
        setShowCreate(false);
        setForm({ name: "", amount: "", period: "monthly", category_id: "", start_date: new Date().toISOString().slice(0, 10) });
        load();
    };

    const fmt = currencyFormatter(ledger?.currency_code);

    return (
        <AppShell>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Budgets</h1>
                    <p className="text-sm text-zinc-400">Track spending against your limits</p>
                </div>
                {canWrite && <Button onClick={() => setShowCreate(true)}>+ New Budget</Button>}
            </div>

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}</div>
            ) : budgets.length === 0 ? (
                <EmptyState icon="🎯" title="No budgets" description="Create budgets to track your spending." />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                    {budgets.map(({ budget, spent }) => {
                        const pct = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
                        const isOver = spent > budget.amount;
                        return (
                            <div key={budget.id} className={`rounded-2xl border ${isOver ? "border-red-800/50" : "border-zinc-800"} bg-zinc-900/50 p-5`}>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-semibold text-white">{budget.name}</h3>
                                    <Badge color={isOver ? "red" : pct > 75 ? "amber" : "emerald"}>{budget.period}</Badge>
                                </div>
                                <p className="text-sm text-zinc-400 mb-2">{budget.category?.name ?? "All categories"}</p>
                                <div className="mb-2 flex items-end justify-between">
                                    <span className={`text-xl font-bold ${isOver ? "text-red-400" : "text-white"}`}>{fmt(spent)}</span>
                                    <span className="text-sm text-zinc-400">of {fmt(budget.amount)}</span>
                                </div>
                                <div className="h-2.5 rounded-full bg-zinc-800 mb-3">
                                    <div className={`h-2.5 rounded-full transition-all ${isOver ? "bg-red-500" : pct > 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                                </div>
                                {canWrite && !budget.is_active && (
                                    <Badge color="zinc">Inactive</Badge>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Budget">
                <div className="space-y-4">
                    <Input id="b-name" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Dining Out" />
                    <Input id="b-amount" label="Amount" type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    <Select id="b-period" label="Period" value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value as BudgetPeriod })} options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "yearly", label: "Yearly" }]} />
                    <Select id="b-cat" label="Category (optional)" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} options={[{ value: "", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
                    <div className="flex gap-3 pt-2"><Button onClick={handleCreate}>Create</Button><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button></div>
                </div>
            </Modal>
        </AppShell>
    );
}
