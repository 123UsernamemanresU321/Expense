"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { CardSkeleton } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { currencyFormatter } from "@/lib/format";
import { getTransactions } from "@/lib/api/transactions";
import { getBudgets, getBudgetSpent } from "@/lib/api/budgets";
import { getMonthlySummaries, aggregateSummaries } from "@/lib/api/insights";
import { getAccounts } from "@/lib/api/accounts";
import { getCategories } from "@/lib/api/categories";
import type { Transaction, MonthlySummary, Budget, Account, Category } from "@/types/database";

export default function DashboardPage() {
    const { ledger } = useAuth();
    const [loading, setLoading] = useState(true);
    const [recentTxns, setRecentTxns] = useState<Transaction[]>([]);
    const [summary, setSummary] = useState<MonthlySummary | null>(null);
    const [budgets, setBudgets] = useState<{ budget: Budget; spent: number }[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [categorySpending, setCategorySpending] = useState<{ name: string; total: number; color: string }[]>([]);

    useEffect(() => {
        if (!ledger) return;
        const load = async () => {
            setLoading(true);
            const now = new Date();
            const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

            const [txns, summaries, bList, accts, cats] = await Promise.all([
                getTransactions({ ledgerId: ledger.id, limit: 5 }).catch(() => []),
                getMonthlySummaries(ledger.id, 1).catch(() => []),
                getBudgets(ledger.id).catch(() => []),
                getAccounts(ledger.id).catch(() => []),
                getCategories(ledger.id).catch(() => []),
            ]);

            // Compute category spending for current month
            const monthTxns = await getTransactions({
                ledgerId: ledger.id,
                startDate: `${month}-01`,
                endDate: `${month}-31`,
                limit: 1000,
            }).catch(() => []);

            const spendMap = new Map<string, { name: string; total: number; color: string }>();
            const catMap = new Map(cats.map((c: Category) => [c.id, c]));
            const catColors = ["#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#3b82f6", "#ec4899", "#14b8a6", "#f97316"];
            for (const t of monthTxns) {
                if (t.txn_type !== "expense") continue;
                const catId = t.category_id ?? "uncategorized";
                const cat = catMap.get(catId);
                const existing = spendMap.get(catId);
                if (existing) {
                    existing.total += Number(t.amount);
                } else {
                    spendMap.set(catId, {
                        name: cat?.name ?? "Uncategorized",
                        total: Number(t.amount),
                        color: catColors[spendMap.size % catColors.length],
                    });
                }
            }
            setCategorySpending(
                Array.from(spendMap.values()).sort((a, b) => b.total - a.total).slice(0, 8)
            );

            setRecentTxns(txns);
            setSummary(summaries[0] ?? null);
            setAccounts(accts.filter((a) => a.is_active));

            // Compute spent for each active budget
            const budgetSpents = await Promise.all(
                bList.filter((b) => b.is_active).slice(0, 4).map(async (b) => ({
                    budget: b,
                    spent: await getBudgetSpent(b).catch(() => 0),
                }))
            );
            setBudgets(budgetSpents);

            // Auto-aggregate if no summary exists
            if (summaries.length === 0) {
                await aggregateSummaries(ledger.id, month).catch(() => null);
                const fresh = await getMonthlySummaries(ledger.id, 1).catch(() => []);
                setSummary(fresh[0] ?? null);
            }

            setLoading(false);
        };
        load();
    }, [ledger]);

    const fmt = currencyFormatter(ledger?.currency_code);
    const netWorth = accounts.reduce((s, a) => s + Number(a.balance), 0);

    return (
        <AppShell>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-sm text-zinc-400">Your financial overview</p>
                </div>
                <Link
                    href="/transactions/new"
                    className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30 transition-all"
                >
                    + New Transaction
                </Link>
            </div>

            {/* Stats Grid */}
            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                    {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
                    <StatCard label="Total Income" value={fmt(summary?.total_income ?? 0)} icon="📈" color="emerald" />
                    <StatCard label="Total Expenses" value={fmt(summary?.total_expense ?? 0)} icon="📉" color="red" />
                    <StatCard label="Net Savings" value={fmt(summary?.net_savings ?? 0)} icon="💰" color={((summary?.net_savings ?? 0) >= 0) ? "emerald" : "red"} />
                    <StatCard label="Net Worth" value={fmt(netWorth)} icon="🏦" color="blue" />
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Transactions */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
                        <Link href="/transactions" className="text-xs text-emerald-400 hover:text-emerald-300">View all →</Link>
                    </div>
                    {recentTxns.length === 0 ? (
                        <p className="py-8 text-center text-sm text-zinc-500">No transactions yet</p>
                    ) : (
                        <div className="space-y-3">
                            {recentTxns.map((txn) => (
                                <div key={txn.id} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-3">
                                    <div>
                                        <p className="text-sm font-medium text-white">{txn.description || "Untitled"}</p>
                                        <p className="text-xs text-zinc-400">{txn.date} · {txn.category?.name ?? "Uncategorized"}</p>
                                    </div>
                                    <span className={`text-sm font-semibold ${txn.txn_type === "income" || txn.txn_type === "refund" ? "text-emerald-400" : "text-red-400"}`}>
                                        {txn.txn_type === "income" || txn.txn_type === "refund" ? "+" : "-"}{fmt(Number(txn.amount))}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Budget Summary */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Budget Overview</h2>
                        <Link href="/budgets" className="text-xs text-emerald-400 hover:text-emerald-300">Manage →</Link>
                    </div>
                    {budgets.length === 0 ? (
                        <p className="py-8 text-center text-sm text-zinc-500">No active budgets</p>
                    ) : (
                        <div className="space-y-4">
                            {budgets.map(({ budget, spent }) => {
                                const pct = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;
                                const isOver = spent > budget.amount;
                                return (
                                    <div key={budget.id}>
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                            <span className="font-medium text-zinc-200">{budget.name}</span>
                                            <span className={isOver ? "text-red-400" : "text-zinc-400"}>
                                                {fmt(spent)} / {fmt(budget.amount)}
                                            </span>
                                        </div>
                                        <div className="h-2 rounded-full bg-zinc-800">
                                            <div
                                                className={`h-2 rounded-full transition-all ${isOver ? "bg-red-500" : "bg-emerald-500"}`}
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Accounts */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Accounts</h2>
                        <Link href="/accounts" className="text-xs text-emerald-400 hover:text-emerald-300">Manage →</Link>
                    </div>
                    {accounts.length === 0 ? (
                        <p className="py-4 text-center text-sm text-zinc-500">No accounts yet</p>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            {accounts.map((a) => (
                                <div key={a.id} className="rounded-xl bg-zinc-800/30 px-4 py-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-zinc-200">{a.name}</span>
                                        <Badge color={Number(a.balance) >= 0 ? "emerald" : "red"}>{a.account_type}</Badge>
                                    </div>
                                    <p className="mt-1 text-lg font-bold text-white">{fmt(Number(a.balance))}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Category Spending Breakdown */}
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 lg:col-span-2">
                    <div className="mb-4 flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Spending by Category</h2>
                        <Link href="/categories" className="text-xs text-emerald-400 hover:text-emerald-300">Manage →</Link>
                    </div>
                    {categorySpending.length === 0 ? (
                        <p className="py-4 text-center text-sm text-zinc-500">No expenses this month</p>
                    ) : (
                        <div className="space-y-3">
                            {(() => {
                                const maxSpend = Math.max(...categorySpending.map((c) => c.total));
                                return categorySpending.map((cat) => (
                                    <div key={cat.name}>
                                        <div className="mb-1 flex items-center justify-between text-sm">
                                            <span className="font-medium text-zinc-200">{cat.name}</span>
                                            <span className="text-zinc-400">{fmt(cat.total)}</span>
                                        </div>
                                        <div className="h-2.5 rounded-full bg-zinc-800">
                                            <div
                                                className="h-2.5 rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${(cat.total / maxSpend) * 100}%`,
                                                    backgroundColor: cat.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>
            </div>
        </AppShell>
    );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) {
    const borderColors: Record<string, string> = {
        emerald: "border-emerald-800/50",
        red: "border-red-800/50",
        blue: "border-blue-800/50",
        amber: "border-amber-800/50",
    };
    return (
        <div className={`rounded-2xl border ${borderColors[color] ?? "border-zinc-800"} bg-zinc-900/50 p-5`}>
            <div className="flex items-center justify-between">
                <p className="text-sm text-zinc-400">{label}</p>
                <span className="text-xl">{icon}</span>
            </div>
            <p className="mt-2 text-2xl font-bold text-white">{value}</p>
        </div>
    );
}
