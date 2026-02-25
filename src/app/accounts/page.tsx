"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, CardSkeleton } from "@/components/ui/empty-state";
import { Button, Input, Select, Modal, Badge } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useAuth } from "@/lib/auth-context";
import { currencyFormatter, formatCurrency } from "@/lib/format";
import { getAccounts, createAccount, updateAccount, reconcileAccount, hardDeleteAccount } from "@/lib/api/accounts";
import { CURRENCIES, getCurrencyInfo, convert } from "@/lib/api/exchange-rates";
import { toast } from "@/lib/errors";
import type { Account, AccountType } from "@/types/database";

const accountTypes: AccountType[] = ["checking", "savings", "credit_card", "cash", "investment", "loan", "other"];

export default function AccountsPage() {
    const { ledger, canWrite } = useAuth();
    const mainCurrency = ledger?.currency_code ?? "USD";
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [convertedBalances, setConvertedBalances] = useState<Map<string, number>>(new Map());
    const [showCreate, setShowCreate] = useState(false);
    const [showReconcile, setShowReconcile] = useState<Account | null>(null);
    const [newAcct, setNewAcct] = useState({ name: "", account_type: "checking" as AccountType, balance: "0", currency_code: mainCurrency });
    const [reconBalance, setReconBalance] = useState("");
    const [creating, setCreating] = useState(false);
    const [reconciling, setReconciling] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<Account | null>(null);
    const [confirmDeactivate, setConfirmDeactivate] = useState<Account | null>(null);
    const [currencySearch, setCurrencySearch] = useState("");

    const load = async () => {
        if (!ledger) return;
        setLoading(true);
        const accts = await getAccounts(ledger.id).catch(() => []);
        setAccounts(accts);

        // Convert balances to main currency
        const converted = new Map<string, number>();
        await Promise.all(
            accts.filter((a) => a.is_active).map(async (a) => {
                if (a.currency_code === mainCurrency) {
                    converted.set(a.id, Number(a.balance));
                } else {
                    converted.set(a.id, await convert(Number(a.balance), a.currency_code, mainCurrency));
                }
            })
        );
        setConvertedBalances(converted);
        setLoading(false);
    };

    useEffect(() => { load(); }, [ledger]);
    useEffect(() => { setNewAcct((a) => ({ ...a, currency_code: mainCurrency })); }, [mainCurrency]);

    const handleCreate = async () => {
        if (!ledger || !newAcct.name) return;
        setCreating(true);
        try {
            await createAccount({
                ledger_id: ledger.id,
                name: newAcct.name,
                account_type: newAcct.account_type,
                currency_code: newAcct.currency_code,
                balance: parseFloat(newAcct.balance) || 0,
            });
            toast("Account created!", "success");
            setShowCreate(false);
            setNewAcct({ name: "", account_type: "checking", balance: "0", currency_code: mainCurrency });
            setCurrencySearch("");
            load();
        } catch {
            toast("Failed to create account", "error");
        } finally {
            setCreating(false);
        }
    };

    const handleReconcile = async () => {
        if (!ledger || !showReconcile || !reconBalance) return;
        setReconciling(true);
        try {
            const r = await reconcileAccount({ ledger_id: ledger.id, account_id: showReconcile.id, snapshot_date: new Date().toISOString().slice(0, 10), statement_balance: parseFloat(reconBalance) });
            if (r.error) { toast(r.error, "error"); return; }
            toast(r.data?.is_reconciled ? "Account reconciled! ✅" : `Difference: $${r.data?.difference}`, r.data?.is_reconciled ? "success" : "info");
            setShowReconcile(null);
            setReconBalance("");
            load();
        } catch {
            toast("Reconciliation failed", "error");
        } finally {
            setReconciling(false);
        }
    };

    const handleDelete = async (account: Account) => {
        setDeletingId(account.id);
        try {
            await hardDeleteAccount(account.id);
            toast("Account deleted", "success");
            load();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "";
            if (msg.includes("foreign key") || msg.includes("violates")) {
                toast("Cannot delete: account has transactions. Move or delete them first.", "error");
            } else {
                toast("Failed to delete account", "error");
            }
        } finally {
            setDeletingId(null);
        }
    };

    const handleDeactivate = async (account: Account) => {
        try {
            await updateAccount(account.id, { is_active: false });
            toast("Account deactivated", "info");
            load();
        } catch {
            toast("Failed to deactivate account", "error");
        }
    };

    const fmt = currencyFormatter(mainCurrency);
    const totalConverted = Array.from(convertedBalances.values()).reduce((s, v) => s + v, 0);

    const filteredCurrencies = CURRENCIES.filter(
        (c) => !currencySearch || c.code.includes(currencySearch.toUpperCase()) || c.name.toLowerCase().includes(currencySearch.toLowerCase())
    );

    return (
        <AppShell>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Accounts</h1>
                    <p className="text-sm text-zinc-400">
                        Total balance: <span className="font-semibold text-emerald-400">{fmt(totalConverted)}</span>
                        {accounts.some((a) => a.is_active && a.currency_code !== mainCurrency) && (
                            <span className="ml-1 text-xs text-zinc-500">(converted to {mainCurrency})</span>
                        )}
                    </p>
                </div>
                {canWrite && <Button onClick={() => setShowCreate(true)}>+ New Account</Button>}
            </div>

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
            ) : accounts.length === 0 ? (
                <EmptyState icon="🏦" title="No accounts" description="Add your bank accounts, credit cards, and other financial accounts." />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {accounts.map((a) => {
                        const ci = getCurrencyInfo(a.currency_code);
                        const isForeign = a.currency_code !== mainCurrency;
                        const acctFmt = currencyFormatter(a.currency_code);
                        return (
                            <div key={a.id} className={`rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 ${!a.is_active ? "opacity-50" : ""}`}>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="font-semibold text-white">{a.name}</h3>
                                    <div className="flex gap-1.5">
                                        <Badge color={Number(a.balance) >= 0 ? "emerald" : "red"}>{a.account_type.replace("_", " ")}</Badge>
                                        <span className="rounded-lg bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300" title={ci.name}>
                                            {ci.flag} {ci.code}
                                        </span>
                                    </div>
                                </div>
                                <p className="text-2xl font-bold text-white">{acctFmt(Number(a.balance))}</p>
                                {isForeign && convertedBalances.has(a.id) && (
                                    <p className="text-xs text-zinc-500 mt-0.5">
                                        ≈ {fmt(convertedBalances.get(a.id)!)}
                                    </p>
                                )}
                                {a.institution && <p className="text-xs text-zinc-500 mt-2">{a.institution}</p>}
                                {canWrite && (
                                    <div className="flex gap-2 flex-wrap mt-3">
                                        {a.is_active && (
                                            <>
                                                <Button variant="secondary" size="sm" onClick={() => { setShowReconcile(a); setReconBalance(""); }}>Reconcile</Button>
                                                <Button variant="ghost" size="sm" onClick={() => setConfirmDeactivate(a)}>Deactivate</Button>
                                            </>
                                        )}
                                        <Button
                                            variant="ghost" size="sm"
                                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                            disabled={deletingId === a.id}
                                            onClick={() => setConfirmDelete(a)}
                                        >
                                            {deletingId === a.id ? "Deleting..." : "Delete"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create Account Modal */}
            <Modal open={showCreate} onClose={() => { setShowCreate(false); setCurrencySearch(""); }} title="New Account">
                <div className="space-y-4">
                    <Input id="acct-name" label="Name" value={newAcct.name} onChange={(e) => setNewAcct({ ...newAcct, name: e.target.value })} placeholder="My Checking" />
                    <Select id="acct-type" label="Type" value={newAcct.account_type} onChange={(e) => setNewAcct({ ...newAcct, account_type: e.target.value as AccountType })} options={accountTypes.map((t) => ({ value: t, label: t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))} />

                    {/* Currency Selector with Search */}
                    <div>
                        <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Currency</label>
                        <input
                            type="text"
                            placeholder="Search currencies..."
                            value={currencySearch}
                            onChange={(e) => setCurrencySearch(e.target.value)}
                            className="mb-2 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                        />
                        <div className="max-h-40 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-800">
                            {filteredCurrencies.map((c) => (
                                <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => { setNewAcct({ ...newAcct, currency_code: c.code }); setCurrencySearch(""); }}
                                    className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-zinc-700 ${newAcct.currency_code === c.code ? "bg-emerald-900/30 text-emerald-400" : "text-zinc-300"}`}
                                >
                                    <span>{c.flag}</span>
                                    <span className="font-medium">{c.code}</span>
                                    <span className="text-zinc-500 text-xs">{c.name}</span>
                                </button>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">Selected: {getCurrencyInfo(newAcct.currency_code).flag} {newAcct.currency_code}</p>
                    </div>

                    <Input id="acct-balance" label="Starting Balance" type="number" step="0.01" value={newAcct.balance} onChange={(e) => setNewAcct({ ...newAcct, balance: e.target.value })} />
                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleCreate} disabled={creating}>{creating ? "Creating..." : "Create"}</Button>
                        <Button variant="secondary" onClick={() => { setShowCreate(false); setCurrencySearch(""); }}>Cancel</Button>
                    </div>
                </div>
            </Modal>

            {/* Reconcile Modal */}
            <Modal open={!!showReconcile} onClose={() => setShowReconcile(null)} title={`Reconcile: ${showReconcile?.name ?? ""}`}>
                <div className="space-y-4">
                    <p className="text-sm text-zinc-400">Enter the balance from your bank statement ({showReconcile?.currency_code}).</p>
                    <Input id="recon-balance" label="Statement Balance" type="number" step="0.01" value={reconBalance} onChange={(e) => setReconBalance(e.target.value)} placeholder="0.00" />
                    <div className="flex gap-3 pt-2">
                        <Button onClick={handleReconcile} disabled={reconciling}>{reconciling ? "Reconciling..." : "Reconcile"}</Button>
                        <Button variant="secondary" onClick={() => setShowReconcile(null)}>Cancel</Button>
                    </div>
                </div>
            </Modal>

            <ConfirmDialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete); }} title="Delete Account" message={`Permanently delete "${confirmDelete?.name}"? Accounts with transactions can't be deleted.`} confirmLabel="Delete" variant="danger" />
            <ConfirmDialog open={!!confirmDeactivate} onClose={() => setConfirmDeactivate(null)} onConfirm={() => { if (confirmDeactivate) handleDeactivate(confirmDeactivate); }} title="Deactivate Account" message={`Deactivate "${confirmDeactivate?.name}"? It can be reactivated later.`} confirmLabel="Deactivate" variant="primary" />
        </AppShell>
    );
}
