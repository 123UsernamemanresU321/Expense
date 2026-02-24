"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Badge, Button, Select } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { getTransactions, deleteTransaction, type TxnFilters } from "@/lib/api/transactions";
import { getCategories } from "@/lib/api/categories";
import { getAccounts } from "@/lib/api/accounts";
import { toast } from "@/lib/errors";
import type { Transaction, Category, Account, TxnType } from "@/types/database";

const PAGE_SIZE = 25;

export default function TransactionsPage() {
    const { ledger, canWrite } = useAuth();
    const [loading, setLoading] = useState(true);
    const [txns, setTxns] = useState<Transaction[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);

    // Filters
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [catFilter, setCatFilter] = useState("");
    const [acctFilter, setAcctFilter] = useState("");

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(t);
    }, [search]);

    // Load filter options
    useEffect(() => {
        if (!ledger) return;
        getCategories(ledger.id).then(setCategories).catch(() => { });
        getAccounts(ledger.id).then(setAccounts).catch(() => { });
    }, [ledger]);

    const fetchTxns = useCallback(async () => {
        if (!ledger) return;
        setLoading(true);
        const f: TxnFilters = {
            ledgerId: ledger.id,
            limit: PAGE_SIZE + 1,
            offset: page * PAGE_SIZE,
        };
        if (debouncedSearch) f.search = debouncedSearch;
        if (typeFilter) f.txnType = typeFilter as TxnType;
        if (catFilter) f.categoryId = catFilter;
        if (acctFilter) f.accountId = acctFilter;

        const data = await getTransactions(f).catch(() => []);
        setHasMore(data.length > PAGE_SIZE);
        setTxns(data.slice(0, PAGE_SIZE));
        setLoading(false);
    }, [ledger, page, debouncedSearch, typeFilter, catFilter, acctFilter]);

    useEffect(() => { fetchTxns(); }, [fetchTxns]);

    // Reset page when filters change
    useEffect(() => { setPage(0); }, [debouncedSearch, typeFilter, catFilter, acctFilter]);

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this transaction?")) return;
        await deleteTransaction(id);
        toast("Transaction deleted", "success");
        fetchTxns();
    };

    const fmt = (n: number) => `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    const typeColor: Record<string, "emerald" | "red" | "blue" | "amber" | "purple"> = {
        income: "emerald", expense: "red", transfer: "blue", refund: "amber", adjustment: "purple",
    };

    const catOptions = useMemo(() => [
        { value: "", label: "All Categories" },
        ...categories.map((c) => ({ value: c.id, label: c.name })),
    ], [categories]);

    const acctOptions = useMemo(() => [
        { value: "", label: "All Accounts" },
        ...accounts.map((a) => ({ value: a.id, label: a.name })),
    ], [accounts]);

    return (
        <AppShell>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Transactions</h1>
                    <p className="text-sm text-zinc-400">View and manage all transactions</p>
                </div>
                {canWrite && (
                    <Link
                        href="/transactions/new"
                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all"
                    >
                        + New Transaction
                    </Link>
                )}
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap gap-3">
                <input
                    type="text"
                    placeholder="Search description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none w-64"
                />
                <Select id="type" label="" options={[{ value: "", label: "All Types" }, ...["income", "expense", "transfer", "refund", "adjustment"].map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))]} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
                <Select id="category" label="" options={catOptions} value={catFilter} onChange={(e) => setCatFilter(e.target.value)} />
                <Select id="account" label="" options={acctOptions} value={acctFilter} onChange={(e) => setAcctFilter(e.target.value)} />
            </div>

            {/* Table */}
            {loading ? (
                <TableSkeleton rows={8} />
            ) : txns.length === 0 ? (
                <EmptyState
                    icon="💳"
                    title="No transactions"
                    description="Create your first transaction to get started."
                    action={canWrite ? <Link href="/transactions/new" className="text-sm text-emerald-400 hover:text-emerald-300">+ Add transaction</Link> : undefined}
                />
            ) : (
                <div className="overflow-hidden rounded-2xl border border-zinc-800">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-left text-xs text-zinc-400">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Description</th>
                                <th className="px-4 py-3 font-medium">Category</th>
                                <th className="px-4 py-3 font-medium">Account</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 text-right font-medium">Amount</th>
                                {canWrite && <th className="px-4 py-3 w-10" />}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {txns.map((txn) => (
                                <tr key={txn.id} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-4 py-3 text-zinc-300">{txn.date}</td>
                                    <td className="px-4 py-3 font-medium text-white">{txn.description || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-400">{txn.category?.name ?? "—"}</td>
                                    <td className="px-4 py-3 text-zinc-400">{txn.account?.name ?? "—"}</td>
                                    <td className="px-4 py-3"><Badge color={typeColor[txn.txn_type] ?? "zinc"}>{txn.txn_type}</Badge></td>
                                    <td className={`px-4 py-3 text-right font-semibold ${txn.txn_type === "income" || txn.txn_type === "refund" ? "text-emerald-400" : "text-red-400"}`}>
                                        {txn.txn_type === "income" || txn.txn_type === "refund" ? "+" : "-"}{fmt(Number(txn.amount))}
                                    </td>
                                    {canWrite && (
                                        <td className="px-4 py-3">
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(txn.id)}>🗑️</Button>
                                        </td>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Pagination */}
            <div className="mt-4 flex items-center justify-between">
                <Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                    ← Previous
                </Button>
                <span className="text-sm text-zinc-500">Page {page + 1}</span>
                <Button variant="secondary" size="sm" disabled={!hasMore} onClick={() => setPage(page + 1)}>
                    Next →
                </Button>
            </div>
        </AppShell>
    );
}
