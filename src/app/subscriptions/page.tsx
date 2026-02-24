"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Button, Input, Select, Modal, Badge } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { getSubscriptions, createSubscription, cancelSubscription, generateInstances } from "@/lib/api/subscriptions";
import { getAccounts } from "@/lib/api/accounts";
import { getCategories } from "@/lib/api/categories";
import { toast } from "@/lib/errors";
import type { Subscription, SubInterval, Account, Category } from "@/types/database";

export default function SubscriptionsPage() {
    const { ledger, canWrite } = useAuth();
    const [loading, setLoading] = useState(true);
    const [subs, setSubs] = useState<Subscription[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categories, setCategories] = useState<Category[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [form, setForm] = useState({ name: "", amount: "", interval: "monthly" as SubInterval, next_due_date: "", account_id: "", category_id: "" });

    const load = async () => {
        if (!ledger) return;
        setLoading(true);
        const [s, a, c] = await Promise.all([
            getSubscriptions(ledger.id).catch(() => []),
            getAccounts(ledger.id).catch(() => []),
            getCategories(ledger.id).catch(() => []),
        ]);
        setSubs(s);
        setAccounts(a);
        setCategories(c);
        setLoading(false);
    };

    useEffect(() => { load(); }, [ledger]);

    const handleCreate = async () => {
        if (!ledger || !form.name || !form.amount || !form.account_id || !form.next_due_date) return;
        await createSubscription({ ledger_id: ledger.id, name: form.name, amount: parseFloat(form.amount), interval: form.interval, next_due_date: form.next_due_date, account_id: form.account_id, category_id: form.category_id || undefined });
        toast("Subscription added!", "success");
        setShowCreate(false);
        load();
    };

    const handleGenerate = async () => {
        if (!ledger) return;
        setGenerating(true);
        const r = await generateInstances(ledger.id);
        if (r.error) toast(r.error, "error");
        else toast(`Generated ${r.data?.transactions_created ?? 0} transactions`, "success");
        setGenerating(false);
    };

    const fmt = (n: number) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const monthlyTotal = subs.filter((s) => s.is_active).reduce((sum, s) => {
        const multiplier: Record<string, number> = { daily: 30, weekly: 4.33, monthly: 1, quarterly: 1 / 3, yearly: 1 / 12 };
        return sum + Number(s.amount) * (multiplier[s.interval] ?? 1);
    }, 0);

    return (
        <AppShell>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Subscriptions</h1>
                    <p className="text-sm text-zinc-400">Monthly cost: <span className="font-semibold text-amber-400">{fmt(monthlyTotal)}</span></p>
                </div>
                <div className="flex gap-3">
                    {canWrite && <Button variant="secondary" onClick={handleGenerate} disabled={generating}>{generating ? "Generating..." : "Generate Instances"}</Button>}
                    {canWrite && <Button onClick={() => setShowCreate(true)}>+ New Subscription</Button>}
                </div>
            </div>

            {loading ? <TableSkeleton rows={5} /> : subs.length === 0 ? (
                <EmptyState icon="🔄" title="No subscriptions" description="Track your recurring payments here." />
            ) : (
                <div className="overflow-hidden rounded-2xl border border-zinc-800">
                    <table className="w-full text-sm">
                        <thead><tr className="border-b border-zinc-800 bg-zinc-900/80 text-left text-xs text-zinc-400">
                            <th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Interval</th><th className="px-4 py-3 font-medium">Next Due</th><th className="px-4 py-3 font-medium">Status</th>{canWrite && <th className="px-4 py-3 w-10" />}
                        </tr></thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {subs.map((s) => (
                                <tr key={s.id} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                                    <td className="px-4 py-3 text-amber-400 font-semibold">{fmt(Number(s.amount))}</td>
                                    <td className="px-4 py-3"><Badge color="blue">{s.interval}</Badge></td>
                                    <td className="px-4 py-3 text-zinc-300">{s.next_due_date}</td>
                                    <td className="px-4 py-3">{s.is_active ? <Badge color="emerald">Active</Badge> : <Badge color="zinc">Cancelled</Badge>}</td>
                                    {canWrite && (
                                        <td className="px-4 py-3">
                                            {s.is_active && <Button variant="ghost" size="sm" onClick={async () => { await cancelSubscription(s.id); toast("Subscription cancelled", "info"); load(); }}>Cancel</Button>}
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Subscription">
                <div className="space-y-4">
                    <Input id="s-name" label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Netflix" />
                    <Input id="s-amount" label="Amount" type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                    <Select id="s-interval" label="Interval" value={form.interval} onChange={(e) => setForm({ ...form, interval: e.target.value as SubInterval })} options={[{ value: "daily", label: "Daily" }, { value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "yearly", label: "Yearly" }]} />
                    <Input id="s-due" label="Next Due Date" type="date" value={form.next_due_date} onChange={(e) => setForm({ ...form, next_due_date: e.target.value })} />
                    <Select id="s-acct" label="Account" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} options={[{ value: "", label: "Select account" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]} />
                    <Select id="s-cat" label="Category (optional)" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} options={[{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
                    <div className="flex gap-3 pt-2"><Button onClick={handleCreate}>Create</Button><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button></div>
                </div>
            </Modal>
        </AppShell>
    );
}
