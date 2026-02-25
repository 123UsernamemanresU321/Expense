"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Button, Input, Select } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { createTransaction, createTransfer } from "@/lib/api/transactions";
import { getCategories } from "@/lib/api/categories";
import { getAccounts } from "@/lib/api/accounts";
import { getCurrencyInfo, convert } from "@/lib/api/exchange-rates";
import { formatCurrency } from "@/lib/format";
import { toast } from "@/lib/errors";
import type { Category, Account, TxnType } from "@/types/database";

export default function NewTransactionPage() {
    const { ledger } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [useDifferentCurrency, setUseDifferentCurrency] = useState(false);
    const [convertedPreview, setConvertedPreview] = useState<string | null>(null);

    const [form, setForm] = useState({
        txn_type: "expense" as TxnType,
        amount: "",
        date: new Date().toISOString().slice(0, 10),
        description: "",
        notes: "",
        category_id: "",
        account_id: "",
        to_account_id: "",
        currency_code: "",
    });

    useEffect(() => {
        if (!ledger) return;
        getCategories(ledger.id).then(setCategories).catch(() => { });
        getAccounts(ledger.id).then((a) => {
            setAccounts(a);
            if (a.length > 0 && !form.account_id) {
                setForm((f) => ({ ...f, account_id: a[0].id, currency_code: a[0].currency_code }));
            }
        }).catch(() => { });
    }, [ledger]);

    // Get selected account's currency
    const selectedAccount = useMemo(() => accounts.find((a) => a.id === form.account_id), [accounts, form.account_id]);
    const accountCurrency = selectedAccount?.currency_code ?? ledger?.currency_code ?? "USD";

    // Auto-set currency when account changes
    useEffect(() => {
        if (!useDifferentCurrency && selectedAccount) {
            setForm((f) => ({ ...f, currency_code: selectedAccount.currency_code }));
        }
    }, [selectedAccount, useDifferentCurrency]);

    // Live conversion preview
    useEffect(() => {
        if (!form.amount || !form.currency_code || form.currency_code === accountCurrency) {
            setConvertedPreview(null);
            return;
        }
        const amt = parseFloat(form.amount);
        if (isNaN(amt) || amt <= 0) { setConvertedPreview(null); return; }

        convert(amt, form.currency_code, accountCurrency).then((converted) => {
            setConvertedPreview(`≈ ${formatCurrency(converted, accountCurrency)}`);
        });
    }, [form.amount, form.currency_code, accountCurrency]);

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
                    currency_code: form.currency_code || accountCurrency,
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

    const acctCurrencyInfo = getCurrencyInfo(accountCurrency);
    const txnCurrencyInfo = getCurrencyInfo(form.currency_code || accountCurrency);

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

                    <Select
                        id="account_id"
                        label={form.txn_type === "transfer" ? "From Account" : "Account"}
                        value={form.account_id}
                        onChange={(e) => set("account_id", e.target.value)}
                        options={[
                            { value: "", label: "Select account" },
                            ...accounts.map((a) => ({
                                value: a.id,
                                label: `${getCurrencyInfo(a.currency_code).flag} ${a.name} (${a.currency_code})`,
                            })),
                        ]}
                    />

                    {form.txn_type === "transfer" && (
                        <Select
                            id="to_account_id"
                            label="To Account"
                            value={form.to_account_id}
                            onChange={(e) => set("to_account_id", e.target.value)}
                            options={[
                                { value: "", label: "Select destination" },
                                ...accounts.map((a) => ({
                                    value: a.id,
                                    label: `${getCurrencyInfo(a.currency_code).flag} ${a.name} (${a.currency_code})`,
                                })),
                            ]}
                        />
                    )}

                    {/* Amount + Currency */}
                    <div>
                        <div className="flex items-end gap-3">
                            <div className="flex-1">
                                <Input
                                    id="amount"
                                    label={`Amount (${txnCurrencyInfo.flag} ${form.currency_code || accountCurrency})`}
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={form.amount}
                                    onChange={(e) => set("amount", e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Different currency toggle */}
                        {form.txn_type !== "transfer" && (
                            <div className="mt-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={useDifferentCurrency}
                                        onChange={(e) => {
                                            setUseDifferentCurrency(e.target.checked);
                                            if (!e.target.checked) {
                                                setForm((f) => ({ ...f, currency_code: accountCurrency }));
                                            }
                                        }}
                                        className="rounded accent-emerald-500"
                                    />
                                    <span className="text-xs text-zinc-400">Amount is in a different currency</span>
                                </label>

                                {useDifferentCurrency && (
                                    <select
                                        value={form.currency_code}
                                        onChange={(e) => set("currency_code", e.target.value)}
                                        className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                    >
                                        {[
                                            { code: "USD", name: "US Dollar", flag: "🇺🇸" },
                                            { code: "EUR", name: "Euro", flag: "🇪🇺" },
                                            { code: "GBP", name: "British Pound", flag: "🇬🇧" },
                                            { code: "JPY", name: "Japanese Yen", flag: "🇯🇵" },
                                            { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦" },
                                            { code: "AUD", name: "Australian Dollar", flag: "🇦🇺" },
                                            { code: "CHF", name: "Swiss Franc", flag: "🇨🇭" },
                                            { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳" },
                                            { code: "INR", name: "Indian Rupee", flag: "🇮🇳" },
                                            { code: "ZAR", name: "South African Rand", flag: "🇿🇦" },
                                            { code: "BRL", name: "Brazilian Real", flag: "🇧🇷" },
                                            { code: "MXN", name: "Mexican Peso", flag: "🇲🇽" },
                                            { code: "KRW", name: "South Korean Won", flag: "🇰🇷" },
                                            { code: "SEK", name: "Swedish Krona", flag: "🇸🇪" },
                                            { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬" },
                                            { code: "HKD", name: "Hong Kong Dollar", flag: "🇭🇰" },
                                            { code: "NZD", name: "New Zealand Dollar", flag: "🇳🇿" },
                                            { code: "TRY", name: "Turkish Lira", flag: "🇹🇷" },
                                            { code: "ILS", name: "Israeli Shekel", flag: "🇮🇱" },
                                            { code: "AED", name: "UAE Dirham", flag: "🇦🇪" },
                                        ].map((c) => (
                                            <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.name}</option>
                                        ))}
                                    </select>
                                )}

                                {convertedPreview && (
                                    <p className="mt-1.5 text-xs text-emerald-400">
                                        {convertedPreview} in account currency ({acctCurrencyInfo.flag} {accountCurrency})
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <Input id="date" label="Date" type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} />
                    <Input id="description" label="Description" value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What was this for?" />

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
