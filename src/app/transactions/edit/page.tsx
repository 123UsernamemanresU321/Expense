"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button, Input, Select } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { getTransaction, updateTransaction } from "@/lib/api/transactions";
import { getCategories } from "@/lib/api/categories";
import { getAccounts } from "@/lib/api/accounts";
import { toast } from "@/lib/errors";
import type { Category, Account } from "@/types/database";

function EditForm() {
    const { ledger } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const id = searchParams?.get("id");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const [form, setForm] = useState({
        amount: "",
        date: "",
        description: "",
        notes: "",
        category_id: "",
        account_id: "",
    });

    useEffect(() => {
        if (!ledger || !id) return;
        const load = async () => {
            setLoading(true);
            try {
                const [txn, cats, accts] = await Promise.all([
                    getTransaction(id),
                    getCategories(ledger.id),
                    getAccounts(ledger.id),
                ]);
                setForm({
                    amount: String(txn.amount),
                    date: String(txn.date),
                    description: txn.description ?? "",
                    notes: txn.notes ?? "",
                    category_id: txn.category_id ?? "",
                    account_id: txn.account_id ?? "",
                });
                setCategories(cats);
                setAccounts(accts);
            } catch {
                toast("Transaction not found", "error");
                router.push("/transactions");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [ledger, id, router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!id || !form.amount) return;
        setSaving(true);
        try {
            await updateTransaction(id, {
                amount: parseFloat(form.amount),
                date: form.date,
                description: form.description || undefined,
                notes: form.notes || undefined,
                category_id: form.category_id || undefined,
                account_id: form.account_id || undefined,
            });
            toast("Transaction updated!", "success");
            router.push("/transactions");
        } catch {
            toast("Failed to update transaction", "error");
        } finally {
            setSaving(false);
        }
    };

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    if (!id) {
        return (
            <div className="text-center py-16">
                <p className="text-zinc-400">No transaction selected.</p>
                <Button variant="secondary" className="mt-4" onClick={() => router.push("/transactions")}>Back to Transactions</Button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="mx-auto max-w-2xl">
                <div className="animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded bg-zinc-800" />
                    <div className="h-64 rounded-2xl bg-zinc-800/50" />
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-2xl">
            <h1 className="mb-6 text-2xl font-bold text-white">Edit Transaction</h1>

            <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
                <Input id="amount" label="Amount" type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => set("amount", e.target.value)} />
                <Input id="date" label="Date" type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} />
                <Input id="description" label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What was this for?" />

                <Select
                    id="account_id"
                    label="Account"
                    value={form.account_id}
                    onChange={(e) => set("account_id", e.target.value)}
                    options={[{ value: "", label: "Select account" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
                />

                <Select
                    id="category_id"
                    label="Category"
                    value={form.category_id}
                    onChange={(e) => set("category_id", e.target.value)}
                    options={[{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                />

                <Input id="notes" label="Notes (optional)" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Additional details" />

                <div className="flex gap-3 pt-2">
                    <Button type="submit" disabled={saving}>
                        {saving ? "Saving..." : "Save Changes"}
                    </Button>
                    <Button variant="secondary" onClick={() => router.push("/transactions")}>Cancel</Button>
                </div>
            </form>
        </div>
    );
}

export default function EditTransactionPage() {
    return (
        <AppShell>
            <Suspense fallback={
                <div className="mx-auto max-w-2xl animate-pulse space-y-4">
                    <div className="h-8 w-48 rounded bg-zinc-800" />
                    <div className="h-64 rounded-2xl bg-zinc-800/50" />
                </div>
            }>
                <EditForm />
            </Suspense>
        </AppShell>
    );
}
