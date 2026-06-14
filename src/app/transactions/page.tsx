"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Badge, Button, Select } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/format";
import { getTransactions, deleteTransaction, type TxnFilters } from "@/lib/api/transactions";
import { getCategories } from "@/lib/api/categories";
import { getAccounts } from "@/lib/api/accounts";
import { getCurrencyInfo } from "@/lib/api/exchange-rates";
import { toast, safe } from "@/lib/errors";
import type { Transaction, Category, Account, TxnType } from "@/types/database";

const PAGE_SIZE = 25;
const HIDDEN_TXN_STORAGE_VERSION = "v1";

export default function TransactionsPage() {
    const { ledger, canWrite } = useAuth();
    const ledgerId = ledger?.id ?? null;
    const [loading, setLoading] = useState(true);
    const [txns, setTxns] = useState<Transaction[]>([]);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [categories, setCategories] = useState<Category[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
    const [bulkDeleting, setBulkDeleting] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
    const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
    const [hiddenLoadedForLedger, setHiddenLoadedForLedger] = useState<string | null>(null);
    const [showHidden, setShowHidden] = useState(false);

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

    useEffect(() => {
        if (!ledgerId) {
            setHiddenIds(new Set());
            setHiddenLoadedForLedger(null);
            return;
        }

        try {
            const raw = localStorage.getItem(`ledgerly:hidden-transactions:${HIDDEN_TXN_STORAGE_VERSION}:${ledgerId}`);
            const ids = raw ? JSON.parse(raw) : [];
            setHiddenIds(new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []));
        } catch {
            setHiddenIds(new Set());
        }
        setHiddenLoadedForLedger(ledgerId);
        setSelectedIds(new Set());
        setShowHidden(false);
    }, [ledgerId]);

    useEffect(() => {
        if (!ledgerId || hiddenLoadedForLedger !== ledgerId) return;
        try {
            localStorage.setItem(`ledgerly:hidden-transactions:${HIDDEN_TXN_STORAGE_VERSION}:${ledgerId}`, JSON.stringify([...hiddenIds]));
        } catch { }
    }, [ledgerId, hiddenIds, hiddenLoadedForLedger]);

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

    const visibleTxns = useMemo(
        () => txns.filter((txn) => showHidden ? hiddenIds.has(txn.id) : !hiddenIds.has(txn.id)),
        [txns, hiddenIds, showHidden]
    );

    const visibleTxnIds = useMemo(() => visibleTxns.map((txn) => txn.id), [visibleTxns]);
    const selectedTxns = useMemo(() => txns.filter((txn) => selectedIds.has(txn.id)), [txns, selectedIds]);
    const selectedCount = selectedIds.size;
    const hiddenCount = hiddenIds.size;
    const allVisibleSelected = visibleTxnIds.length > 0 && visibleTxnIds.every((id) => selectedIds.has(id));

    useEffect(() => {
        const visibleIds = new Set(visibleTxnIds);
        setSelectedIds((prev) => {
            const next = new Set([...prev].filter((id) => visibleIds.has(id)));
            return next.size === prev.size ? prev : next;
        });
    }, [visibleTxnIds]);

    const toggleSelected = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const toggleSelectAllVisible = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allVisibleSelected) visibleTxnIds.forEach((id) => next.delete(id));
            else visibleTxnIds.forEach((id) => next.add(id));
            return next;
        });
    };

    const clearSelection = () => setSelectedIds(new Set());

    const hideSelected = useCallback(() => {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        setHiddenIds((prev) => new Set([...prev, ...selectedIds]));
        setSelectedIds(new Set());
        toast(`${count} transaction${count === 1 ? "" : "s"} hidden`, "info");
    }, [selectedIds]);

    const unhideSelected = useCallback(() => {
        if (selectedIds.size === 0) return;
        const count = selectedIds.size;
        setHiddenIds((prev) => {
            const next = new Set(prev);
            selectedIds.forEach((id) => next.delete(id));
            return next;
        });
        setSelectedIds(new Set());
        toast(`${count} transaction${count === 1 ? "" : "s"} restored`, "success");
    }, [selectedIds]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!event.ctrlKey || event.metaKey || event.altKey || event.key.toLowerCase() !== "h") return;

            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, select, [contenteditable='true']")) return;

            event.preventDefault();
            if (selectedIds.size > 0) {
                if (showHidden) unhideSelected();
                else hideSelected();
                return;
            }

            setShowHidden((current) => !current);
            setSelectedIds(new Set());
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [hideSelected, selectedIds.size, showHidden, unhideSelected]);

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        const res = await safe(() => deleteTransaction(id), "Failed to delete transaction");
        if (res !== null) {
            toast("Transaction deleted", "success");
            setHiddenIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            setSelectedIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            fetchTxns();
        }
        setDeletingId(null);
    };

    const handleBulkDelete = async () => {
        const ids = [...selectedIds];
        if (ids.length === 0) return;

        setBulkDeleting(true);
        const results = await Promise.allSettled(ids.map((id) => deleteTransaction(id)));
        const deletedIds = ids.filter((_, index) => results[index].status === "fulfilled");
        const failedCount = results.length - deletedIds.length;

        if (deletedIds.length > 0) {
            setHiddenIds((prev) => {
                const next = new Set(prev);
                deletedIds.forEach((id) => next.delete(id));
                return next;
            });
            setSelectedIds(new Set());
            toast(`${deletedIds.length} transaction${deletedIds.length === 1 ? "" : "s"} deleted`, "success");
            fetchTxns();
        }
        if (failedCount > 0) toast(`${failedCount} transaction${failedCount === 1 ? "" : "s"} could not be deleted`, "error");

        setBulkDeleting(false);
        setConfirmBulkDelete(false);
    };

    // CSV Export
    const exportCSV = (rows: Transaction[] = visibleTxns) => {
        if (rows.length === 0) { toast("No transactions to export", "info"); return; }
        const headers = ["Date", "Description", "Category", "Account", "Type", "Amount"];
        const csvRows = rows.map((t) => [
            t.date,
            `"${(t.description ?? "").replace(/"/g, '""')}"`,
            t.category?.name ?? "",
            t.account?.name ?? "",
            t.txn_type,
            String(t.amount),
        ]);
        const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        toast("CSV downloaded!", "success");
    };

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
                    <Button variant="secondary" size="sm" onClick={() => exportCSV()}>
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

            {(selectedCount > 0 || showHidden) && (
                <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/70 px-3 py-2">
                    {showHidden && <Badge color="amber">Hidden rows</Badge>}
                    {selectedCount > 0 && <span className="text-xs font-medium text-zinc-300">{selectedCount} selected</span>}
                    {selectedCount > 0 && (
                        <>
                            <Button variant="secondary" size="sm" onClick={() => exportCSV(selectedTxns)}>
                                Export selected
                            </Button>
                            <Button variant="secondary" size="sm" onClick={showHidden ? unhideSelected : hideSelected}>
                                {showHidden ? "Unhide selected" : "Hide selected"}
                            </Button>
                            {canWrite && (
                                <Button variant="danger" size="sm" onClick={() => setConfirmBulkDelete(true)} disabled={bulkDeleting}>
                                    Delete selected
                                </Button>
                            )}
                            <Button variant="ghost" size="sm" onClick={clearSelection}>
                                Clear selection
                            </Button>
                        </>
                    )}
                    {showHidden && selectedCount === 0 && (
                        <span className="text-xs text-zinc-500">{hiddenCount} hidden transaction{hiddenCount === 1 ? "" : "s"}</span>
                    )}
                </div>
            )}

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
            ) : visibleTxns.length === 0 ? (
                <EmptyState
                    icon={showHidden ? "◌" : "💳"}
                    title={showHidden ? "No hidden transactions" : "No visible transactions"}
                    description={showHidden ? "Hidden transactions matching this page and filter will appear here." : "All transactions on this page are hidden from the visible list."}
                />
            ) : (
                <div className="overflow-x-auto rounded-2xl border border-zinc-800">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-zinc-800 bg-zinc-900/80 text-left text-xs text-zinc-400">
                                <th className="w-10 px-4 py-3">
                                    <input
                                        type="checkbox"
                                        checked={allVisibleSelected}
                                        onChange={toggleSelectAllVisible}
                                        aria-label="Select all visible transactions"
                                        className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
                                    />
                                </th>
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
                            {visibleTxns.map((txn) => (
                                <tr key={txn.id} className={`${selectedIds.has(txn.id) ? "bg-emerald-500/5" : ""} hover:bg-zinc-800/30 transition-colors`}>
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(txn.id)}
                                            onChange={() => toggleSelected(txn.id)}
                                            aria-label={`Select transaction ${txn.description || txn.date}`}
                                            className="h-4 w-4 rounded border-zinc-600 bg-zinc-800 text-emerald-500"
                                        />
                                    </td>
                                    <td className="px-4 py-3 text-zinc-300 whitespace-nowrap">{txn.date}</td>
                                    <td className="px-4 py-3 font-medium text-white">{txn.description || "—"}</td>
                                    <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{txn.category?.name ?? "—"}</td>
                                    <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">{txn.account?.name ?? "—"}</td>
                                    <td className="px-4 py-3"><Badge color={typeColor[txn.txn_type] ?? "zinc"}>{txn.txn_type}</Badge></td>
                                    <td className={`px-4 py-3 text-right whitespace-nowrap ${txn.txn_type === "income" || txn.txn_type === "refund" ? "text-emerald-400" : "text-red-400"}`}>
                                        <span className="font-semibold">{txn.txn_type === "income" || txn.txn_type === "refund" ? "+" : "-"}{formatCurrency(Number(txn.amount), txn.currency_code || ledger?.currency_code)}</span>
                                        {txn.currency_code && txn.currency_code !== (ledger?.currency_code ?? "USD") && (
                                            <span className="ml-1 text-[10px] text-zinc-500">{getCurrencyInfo(txn.currency_code).flag}</span>
                                        )}
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
            <ConfirmDialog
                open={confirmBulkDelete}
                onClose={() => setConfirmBulkDelete(false)}
                onConfirm={handleBulkDelete}
                title="Delete Selected Transactions"
                message={`Permanently delete ${selectedCount} selected transaction${selectedCount === 1 ? "" : "s"}? This cannot be undone.`}
                confirmLabel={bulkDeleting ? "Deleting..." : "Delete"}
                variant="danger"
            />
        </AppShell>
    );
}
