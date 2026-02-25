"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Badge, Button, Select } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/auth-context";
import { currencyFormatter } from "@/lib/format";
import { getTransactions, deleteTransaction, type TxnFilters } from "@/lib/api/transactions";
import { getCategories } from "@/lib/api/categories";
import { getAccounts } from "@/lib/api/accounts";
import { toast, safe } from "@/lib/errors";
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
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    // Filters
    const [search, setSearch] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [catFilter, setCatFilter] = useState("");
    const [acctFilter, setAcctFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

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
        if (dateFrom) f.startDate = dateFrom;
        if (dateTo) f.endDate = dateTo;

        const data = await getTransactions(f).catch(() => []);
        setHasMore(data.length > PAGE_SIZE);
        setTxns(data.slice(0, PAGE_SIZE));
        setLoading(false);
    }, [ledger, page, debouncedSearch, typeFilter, catFilter, acctFilter, dateFrom, dateTo]);

    useEffect(() => { fetchTxns(); }, [fetchTxns]);

    // Reset page when filters change
    useEffect(() => { setPage(0); }, [debouncedSearch, typeFilter, catFilter, acctFilter, dateFrom, dateTo]);

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        const res = await safe(() => deleteTransaction(id), "Failed to delete transaction");
        if (res !== null) {
            toast("Transaction deleted", "success");
            fetchTxns();
        }
        setDeletingId(null);
    };

    // CSV Export
    const exportCSV = () => {
        if (txns.length === 0) { toast("No transactions to export", "info"); return; }
        const headers = ["Date", "Description", "Category", "Account", "Type", "Amount"];
        const rows = txns.map((t) => [
            t.date,
            `"${(t.description ?? "").replace(/"/g, '""')}"`,
            t.category?.name ?? "",
            t.account?.name ?? "",
            t.txn_type,
            String(t.amount),
        ]);
        const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast("CSV downloaded!", "success");
    };

    const fmt = currencyFormatter(ledger?.currency_code);

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
            <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-white">Transactions</h1>
                    <p className="text-sm text-zinc-400">View and manage all transactions</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={exportCSV}>
                        ⬇ Export CSV
                    </Button>
                    {canWrite && (
                        <Link
                            href="/transactions/new"
                            className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl transition-all"
                        >
                            + New Transaction
                        </Link>
                    )}
                </div>
            </div>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap gap-3">
                <input
                    type="text"
                    placeholder="Search description..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none w-48 sm:w-64"
                />
                <Select id="type" label="" options={[{ value: "", label: "All Types" }, ...["income", "expense", "transfer", "refund", "adjustment"].map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))]} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
                <Select id="category" label="" options={catOptions} value={catFilter} onChange={(e) => setCatFilter(e.target.value)} />
                <Select id="account" label="" options={acctOptions} value={acctFilter} onChange={(e) => setAcctFilter(e.target.value)} />
                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        title="From date"
                    />
                    <span className="text-zinc-500 text-xs">to</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                        title="To date"
                    />
                </div>
                {(dateFrom || dateTo || typeFilter || catFilter || acctFilter || search) && (
                    <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter(""); setCatFilter(""); setAcctFilter(""); setDateFrom(""); setDateTo(""); }}>
                        ✕ Clear
                    </Button>
                )}
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
                <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-left text-xs text-zinc-400">
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Description</th>
                                <th className="px-4 py-3 font-medium hidden md:table-cell">Category</th>
                                <th className="px-4 py-3 font-medium hidden lg:table-cell">Account</th>
                                <th className="px-4 py-3 font-medium">Type</th>
                                <th className="px-4 py-3 text-right font-medium">Amount</th>
                                {canWrite && <th className="px-4 py-3 w-20" />}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {txns.map((txn) => (
                                <tr key={txn.id} className="hover:bg-zinc-800/30 transition-colors">
                                    <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{txn.date}</td>
                                    <td className="px-4 py-3 font-medium text-white">{txn.description || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{txn.category?.name ?? "—"}</td>
                                    <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">{txn.account?.name ?? "—"}</td>
                                    <td className="px-4 py-3"><Badge color={typeColor[txn.txn_type] ?? "zinc"}>{txn.txn_type}</Badge></td>
                                    <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${txn.txn_type === "income" || txn.txn_type === "refund" ? "text-emerald-400" : "text-red-400"}`}>
                                        {txn.txn_type === "income" || txn.txn_type === "refund" ? "+" : "-"}{fmt(Number(txn.amount))}
                                    </td>
                                    {canWrite && (
                                        <td className="px-4 py-3">
                                            <div className="flex gap-1">
                                                <Link
                                                    href={`/transactions/edit?id=${txn.id}`}
                                                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors text-xs"
                                                    title="Edit"
                                                >
                                                    ✏️
                                                </Link>
                                                <button
                                                    onClick={() => setConfirmDelete(txn.id)}
                                                    disabled={deletingId === txn.id}
                                                    className="rounded-lg p-1.5 text-zinc-400 hover:bg-red-900/30 hover:text-red-400 transition-colors text-xs disabled:opacity-50"
                                                    title="Delete"
                                                >
                                                    {deletingId === txn.id ? "⏳" : "🗑️"}
                                                </button>
                                            </div>
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

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); }}
                title="Delete Transaction"
                message="Are you sure you want to permanently delete this transaction? This cannot be undone."
                confirmLabel="Delete"
                variant="danger"
            />
        </AppShell>
    );
}
