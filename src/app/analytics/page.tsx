"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CardSkeleton, EmptyState } from "@/components/ui/empty-state";
import { Badge, Button } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { currencyFormatter, formatCurrency } from "@/lib/format";
import { getMonthlySummaries, getInsights, markInsightsRead, generateInsights, aggregateSummaries } from "@/lib/api/insights";
import { getAccounts } from "@/lib/api/accounts";
import { batchConvert, getCurrencyInfo } from "@/lib/api/exchange-rates";
import type { MonthlySummary, Insight, Account } from "@/types/database";

export default function AnalyticsPage() {
    const { ledger } = useAuth();
    const mainCurrency = ledger?.currency_code ?? "USD";
    const [loading, setLoading] = useState(true);
    const [summaries, setSummaries] = useState<MonthlySummary[]>([]);
    const [insights, setInsights] = useState<Insight[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [convertedBalances, setConvertedBalances] = useState<Map<string, number>>(new Map());
    const [netWorth, setNetWorth] = useState(0);
    const [hasMultiCurrency, setHasMultiCurrency] = useState(false);
    const [genLoading, setGenLoading] = useState(false);

    useEffect(() => {
        if (!ledger) return;
        const load = async () => {
            setLoading(true);
            const [s, i, a] = await Promise.all([
                getMonthlySummaries(ledger.id, 12).catch(() => []),
                getInsights(ledger.id).catch(() => []),
                getAccounts(ledger.id).catch(() => []),
            ]);
            const activeAccts = a.filter((x) => x.is_active);
            setSummaries(s);
            setInsights(i);
            setAccounts(activeAccts);

            const multiCurr = activeAccts.some((acc) => acc.currency_code !== mainCurrency);
            setHasMultiCurrency(multiCurr);

            // Convert all account balances to main currency
            const items = activeAccts.map((acc) => ({ amount: Number(acc.balance), currency: acc.currency_code }));
            const converted = await batchConvert(items, mainCurrency);
            const balMap = new Map<string, number>();
            activeAccts.forEach((acc, idx) => balMap.set(acc.id, converted[idx]));
            setConvertedBalances(balMap);
            setNetWorth(converted.reduce((s, v) => s + v, 0));

            setLoading(false);
        };
        load();
    }, [ledger, mainCurrency]);

    const fmt = currencyFormatter(mainCurrency);

    const handleRefreshInsights = async () => {
        if (!ledger) return;
        setGenLoading(true);
        const month = new Date().toISOString().slice(0, 7);
        await aggregateSummaries(ledger.id, month, 3).catch(() => null);
        await generateInsights(ledger.id, month).catch(() => null);
        const [s, i] = await Promise.all([
            getMonthlySummaries(ledger.id, 12).catch(() => []),
            getInsights(ledger.id).catch(() => []),
        ]);
        setSummaries(s);
        setInsights(i);
        setGenLoading(false);
    };

    return (
        <AppShell>
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Analytics</h1>
                    <p className="text-sm text-zinc-400">Financial trends and insights</p>
                </div>
                <Button variant="secondary" onClick={handleRefreshInsights} disabled={genLoading}>
                    {genLoading ? "Refreshing..." : "🔄 Refresh Insights"}
                </Button>
            </div>

            {loading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}</div>
            ) : (
                <>
                    {/* Net Worth / Balance Sheet */}
                    <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <h2 className="text-lg font-semibold text-white">💎 Net Worth: <span className={netWorth >= 0 ? "text-emerald-400" : "text-red-400"}>{fmt(netWorth)}</span></h2>
                            {hasMultiCurrency && <span className="text-[10px] text-zinc-500 bg-zinc-800 rounded-full px-2 py-0.5">💱 converted to {mainCurrency}</span>}
                        </div>
                        {accounts.length === 0 ? (
                            <p className="text-sm text-zinc-500">No accounts to show.</p>
                        ) : (
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {accounts.map((a) => {
                                    const ci = getCurrencyInfo(a.currency_code);
                                    const isForeign = a.currency_code !== mainCurrency;
                                    const acctFmt = currencyFormatter(a.currency_code);
                                    return (
                                        <div key={a.id} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-3">
                                            <div>
                                                <p className="text-sm font-medium text-zinc-200">{a.name}</p>
                                                <p className="text-xs text-zinc-500">{ci.flag} {a.account_type.replace("_", " ")}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`font-semibold ${Number(a.balance) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                                                    {isForeign ? fmt(convertedBalances.get(a.id) ?? 0) : fmt(Number(a.balance))}
                                                </span>
                                                {isForeign && (
                                                    <p className="text-[10px] text-zinc-500">{acctFmt(Number(a.balance))}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Monthly Trend */}
                    <div className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">📊 Monthly Trend</h2>
                        {summaries.length === 0 ? (
                            <p className="text-sm text-zinc-500">No summaries yet. Click &quot;Refresh Insights&quot; to generate.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="text-left text-xs text-zinc-400 border-b border-zinc-800"><th className="px-3 py-2">Month</th><th className="px-3 py-2 text-right">Income</th><th className="px-3 py-2 text-right">Expenses</th><th className="px-3 py-2 text-right">Net</th></tr></thead>
                                    <tbody className="divide-y divide-zinc-800/50">
                                        {summaries.map((s) => (
                                            <tr key={s.year_month} className="hover:bg-zinc-800/20">
                                                <td className="px-3 py-2 text-zinc-300">{s.year_month}</td>
                                                <td className="px-3 py-2 text-right text-emerald-400">{fmt(s.total_income)}</td>
                                                <td className="px-3 py-2 text-right text-red-400">{fmt(s.total_expense)}</td>
                                                <td className={`px-3 py-2 text-right font-semibold ${s.net_savings >= 0 ? "text-emerald-400" : "text-red-400"}`}>{fmt(s.net_savings)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Insights Feed */}
                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                        <h2 className="text-lg font-semibold text-white mb-4">💡 Insights</h2>
                        {insights.length === 0 ? (
                            <EmptyState icon="💡" title="No insights yet" description="Generate insights to get personalized financial tips." />
                        ) : (
                            <div className="space-y-3">
                                {insights.map((ins) => (
                                    <div key={ins.id} className={`rounded-xl px-4 py-3 ${ins.is_read ? "bg-zinc-800/20" : "bg-zinc-800/50 border border-emerald-800/30"}`}>
                                        <div className="flex items-center justify-between mb-1">
                                            <h3 className="text-sm font-semibold text-white">{ins.title}</h3>
                                            <Badge color={ins.is_read ? "zinc" : "emerald"}>{ins.insight_type}</Badge>
                                        </div>
                                        {ins.body && <p className="text-sm text-zinc-400">{ins.body}</p>}
                                        {!ins.is_read && (
                                            <Button variant="ghost" size="sm" className="mt-2" onClick={async () => { await markInsightsRead([ins.id]); setInsights((prev) => prev.map((i) => i.id === ins.id ? { ...i, is_read: true } : i)); }}>
                                                Mark read
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </AppShell>
    );
}
