"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button, Input, Select } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { createTransaction, createTransfer } from "@/lib/api/transactions";
import { getCategories } from "@/lib/api/categories";
import { getAccounts } from "@/lib/api/accounts";
import { toast } from "@/lib/errors";
import type { Category, Account, TxnType } from "@/types/database";

export default function NewTransactionPage() {
    const { ledger } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);

    const [form, setForm] = useState({
        txn_type: "expense" as TxnType,
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        description: "",
        notes: "",
        category_id: "",
        account_id: "",
        to_account_id: "",
    });

    useEffect(() => {
        if (!ledger) return;
        getCategories(ledger.id).then(setCategories).catch(() => { });
        getAccounts(ledger.id).then((a) => {
            setAccounts(a);
            if (a.length > 0 && !form.account_id) setForm((f) => ({ ...f, account_id: a[0].id }));
        }).catch(() => { });
    }, [ledger, form.account_id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ledger || !form.account_id || !form.amount) return;
        if (form.txn_type === "transfer" && !form.to_account_id) {
            toast("Please select a destination account for the transfer", "error");
            return;
        }
        if (form.txn_type === "transfer" && form.account_id === form.to_account_id) {
            toast("Cannot transfer to the same account", "error");
            return;
        }

        setLoading(true);

        try {
            if (form.txn_type === "transfer") {
                await createTransfer({
                    ledger_id: ledger.id,
                    from_account_id: form.account_id,
                    to_account_id: form.to_account_id,
                    amount: parseFloat(form.amount),
                    date: form.date,
                    description: form.description || undefined,
                });
                toast("Transfer complete!", "success");
            } else {
                await createTransaction({
                    ledger_id: ledger.id,
                    account_id: form.account_id,
                    txn_type: form.txn_type,
                    amount: parseFloat(form.amount),
                    date: form.date,
                    description: form.description || undefined,
                    notes: form.notes || undefined,
                    category_id: form.category_id || undefined,
                });
                toast("Transaction created!", "success");
            }
            router.push("/transactions/");
        } catch {
            toast(form.txn_type === "transfer" ? "Failed to create transfer" : "Failed to create transaction", "error");
        } finally {
            setLoading(false);
        }
    };

    const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

    return (
        <AppShell>
            <div className="mx-auto max-w-2xl">
                <h1 className="mb-6 text-2xl font-bold text-white">New Transaction</h1>

                <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8">
                    <Select
                        id="txn_type"
                        label="Type"
                        value={form.txn_type}
                        onChange={(e) => set("txn_type", e.target.value)}
                        options={[
                            { value: "expense", label: "Expense" },
                            { value: "income", label: "Income" },
                            { value: "transfer", label: "Transfer" },
                            { value: "refund", label: "Refund" },
                            { value: "adjustment", label: "Adjustment" },
                        ]}
                    />

                    <Input id="amount" label="Amount" type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0.00" />
                    <Input id="date" label="Date" type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} />
                    <Input id="description" label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What was this for?" />

                    <Select
                        id="account_id"
                        label={form.txn_type === "transfer" ? "From Account" : "Account"}
                        value={form.account_id}
                        onChange={(e) => set("account_id", e.target.value)}
                        options={[{ value: "", label: "Select account" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
                    />

                    {form.txn_type === "transfer" && (
                        <Select
                            id="to_account_id"
                            label="To Account"
                            value={form.to_account_id}
                            onChange={(e) => set("to_account_id", e.target.value)}
                            options={[{ value: "", label: "Select destination" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
                        />
                    )}

                    <Select
                        id="category_id"
                        label="Category"
                        value={form.category_id}
                        onChange={(e) => set("category_id", e.target.value)}
                        options={[{ value: "", label: "None" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
                        disabled={form.txn_type === "transfer"}
                    />

                    <Input id="notes" label="Notes (optional)" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Additional details" />

                    <div className="flex gap-3 pt-2">
                        <Button type="submit" disabled={loading}>
                            {loading ? "Creating..." : "Create Transaction"}
                        </Button>
                        <Button variant="secondary" onClick={() => router.push("/transactions/")}>Cancel</Button>
                    </div>
                </form>
            </div>
        </AppShell>
    );
}
