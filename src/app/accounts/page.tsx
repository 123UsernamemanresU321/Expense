"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, CardSkeleton } from "@/components/ui/empty-state";
import { Button, Input, Select, Modal, Badge } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { currencyFormatter } from "@/lib/format";
import { getAccounts, createAccount, updateAccount, reconcileAccount } from "@/lib/api/accounts";
import { toast } from "@/lib/errors";
import type { Account, AccountType } from "@/types/database";

const accountTypes: AccountType[] = ["checking", "savings", "credit_card", "cash", "investment", "loan", "other"];

export default function AccountsPage() {
    const { ledger, canWrite } = useAuth();
    const [loading, setLoading] = useState(true);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showReconcile, setShowReconcile] = useState<Account | null>(null);
    const [newAcct, setNewAcct] = useState({ name: "", account_type: "checking" as AccountType, balance: "0" });
    const [reconBalance, setReconBalance] = useState("");

    const load = async () => {
        if (!ledger) return;
        setLoading(true);
        setAccounts(await getAccounts(ledger.id).catch(() => []));
        setLoading(false);
    };

    useEffect(() => { load(); }, [ledger]);

    const handleCreate = async () => {
        if (!ledger || !newAcct.name) return;
        await createAccount({ ledger_id: ledger.id, name: newAcct.name, account_type: newAcct.account_type, balance: parseFloat(newAcct.balance) || 0 });
        toast("Account created!", "success");
        setShowCreate(false);
        setNewAcct({ name: "", account_type: "checking", balance: "0" });
        load();
    };

    const handleReconcile = async () => {
        if (!ledger || !showReconcile || !reconBalance) return;
        const r = await reconcileAccount({ ledger_id: ledger.id, account_id: showReconcile.id, snapshot_date: new Date().toISOString().slice(0, 10), statement_balance: parseFloat(reconBalance) });
        if (r.error) { toast(r.error, "error"); return; }
        toast(r.data?.is_reconciled ? "Account reconciled! ✅" : `Difference: $${r.data?.difference}`, r.data?.is_reconciled ? "success" : "info");
        setShowReconcile(null);
        setReconBalance("");
        load();
    };

    const fmt = currencyFormatter(ledger?.currency_code);
    const totalBalance = accounts.filter((a) => a.is_active).reduce((s, a) => s + Number(a.balance), 0);

    return (
        <AppShell>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Accounts</h1>
                    <p className="text-sm text-zinc-400">Total balance: <span className="font-semibold text-emerald-400">{fmt(totalBalance)}</span></p>
                </div>
                {canWrite && <Button onClick={() => setShowCreate(true)}>+ New Account</Button>}
            </div>

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}</div>
            ) : accounts.length === 0 ? (
                <EmptyState icon="🏦" title="No accounts" description="Add your bank accounts, credit cards, and other financial accounts." />
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {accounts.map((a) => (
                        <div key={a.id} className={`rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 ${!a.is_active ? "opacity-50" : ""}`}>
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="font-semibold text-white">{a.name}</h3>
                                <Badge color={Number(a.balance) >= 0 ? "emerald" : "red"}>{a.account_type.replace("_", " ")}</Badge>
                            </div>
                            <p className="text-2xl font-bold text-white mb-4">{fmt(Number(a.balance))}</p>
                            {a.institution && <p className="text-xs text-zinc-500 mb-3">{a.institution}</p>}
                            {canWrite && a.is_active && (
                                <div className="flex gap-2">
                                    <Button variant="secondary" size="sm" onClick={() => { setShowReconcile(a); setReconBalance(""); }}>Reconcile</Button>
                                    <Button variant="ghost" size="sm" onClick={async () => { await updateAccount(a.id, { is_active: false }); toast("Account deactivated", "info"); load(); }}>Deactivate</Button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Account">
                <div className="space-y-4">
                    <Input id="acct-name" label="Name" value={newAcct.name} onChange={(e) => setNewAcct({ ...newAcct, name: e.target.value })} placeholder="My Checking" />
                    <Select id="acct-type" label="Type" value={newAcct.account_type} onChange={(e) => setNewAcct({ ...newAcct, account_type: e.target.value as AccountType })} options={accountTypes.map((t) => ({ value: t, label: t.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) }))} />
                    <Input id="acct-balance" label="Starting Balance" type="number" step="0.01" value={newAcct.balance} onChange={(e) => setNewAcct({ ...newAcct, balance: e.target.value })} />
                    <div className="flex gap-3 pt-2"><Button onClick={handleCreate}>Create</Button><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button></div>
                </div>
            </Modal>

            <Modal open={!!showReconcile} onClose={() => setShowReconcile(null)} title={`Reconcile: ${showReconcile?.name ?? ""}`}>
                <div className="space-y-4">
                    <p className="text-sm text-zinc-400">Enter the balance from your bank statement to check if it matches.</p>
                    <Input id="recon-balance" label="Statement Balance" type="number" step="0.01" value={reconBalance} onChange={(e) => setReconBalance(e.target.value)} placeholder="0.00" />
                    <div className="flex gap-3 pt-2"><Button onClick={handleReconcile}>Reconcile</Button><Button variant="secondary" onClick={() => setShowReconcile(null)}>Cancel</Button></div>
                </div>
            </Modal>
        </AppShell>
    );
}
