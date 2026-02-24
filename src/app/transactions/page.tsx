"use client";

import { AppShell } from "@/components/layout/app-shell";

const sampleTransactions = [
    { id: 1, date: "2026-02-10", desc: "Web project payment", category: "Freelance", type: "income" as const, amount: 800.00, account: "Checking" },
    { id: 2, date: "2026-02-08", desc: "Refund — damaged goods", category: "Groceries", type: "refund" as const, amount: 45.00, account: "Visa CC" },
    { id: 3, date: "2026-02-07", desc: "Team dinner + drinks", category: "Restaurants", type: "expense" as const, amount: 85.00, account: "Visa CC" },
    { id: 4, date: "2026-02-06", desc: "Damaged goods purchase", category: "Groceries", type: "expense" as const, amount: 45.00, account: "Visa CC" },
    { id: 5, date: "2026-02-05", desc: "Transfer to savings", category: "—", type: "transfer" as const, amount: 1000.00, account: "Checking" },
    { id: 6, date: "2026-02-05", desc: "Latte", category: "Restaurants", type: "expense" as const, amount: 5.75, account: "Visa CC" },
    { id: 7, date: "2026-02-04", desc: "Uber to airport", category: "Transportation", type: "expense" as const, amount: 24.50, account: "Visa CC" },
    { id: 8, date: "2026-02-03", desc: "Weekly groceries", category: "Groceries", type: "expense" as const, amount: 127.50, account: "Visa CC" },
    { id: 9, date: "2026-02-01", desc: "February salary", category: "Salary", type: "income" as const, amount: 4500.00, account: "Checking" },
];

const typeColors: Record<string, string> = {
    income: "text-emerald-400 bg-emerald-400/10",
    expense: "text-red-400 bg-red-400/10",
    transfer: "text-blue-400 bg-blue-400/10",
    refund: "text-amber-400 bg-amber-400/10",
    adjustment: "text-violet-400 bg-violet-400/10",
};

export default function TransactionsPage() {
    return (
        <AppShell>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Transactions</h1>
                        <p className="mt-1 text-sm text-zinc-400">
                            All transactions for Household Budget
                        </p>
                    </div>
                    <button className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5">
                        + Add Transaction
                    </button>
                </div>

                {/* Filters Bar */}
                <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 backdrop-blur-sm">
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        className="flex-1 min-w-[200px] rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <select className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 focus:border-emerald-500 focus:outline-none">
                        <option value="">All Types</option>
                        <option value="income">Income</option>
                        <option value="expense">Expense</option>
                        <option value="transfer">Transfer</option>
                        <option value="refund">Refund</option>
                    </select>
                    <select className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 focus:border-emerald-500 focus:outline-none">
                        <option value="">All Accounts</option>
                        <option value="checking">Checking</option>
                        <option value="visa">Visa CC</option>
                        <option value="savings">Savings</option>
                    </select>
                    <input
                        type="month"
                        defaultValue="2026-02"
                        className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-zinc-300 focus:border-emerald-500 focus:outline-none"
                    />
                </div>

                {/* Transactions Table */}
                <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                                <th className="px-6 py-4">Date</th>
                                <th className="px-6 py-4">Description</th>
                                <th className="px-6 py-4">Category</th>
                                <th className="px-6 py-4">Type</th>
                                <th className="px-6 py-4">Account</th>
                                <th className="px-6 py-4 text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                            {sampleTransactions.map((txn) => (
                                <tr
                                    key={txn.id}
                                    className="transition-colors hover:bg-zinc-800/30 cursor-pointer"
                                >
                                    <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-400">
                                        {txn.date}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-zinc-200">
                                        {txn.desc}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-400">
                                        {txn.category}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-medium ${typeColors[txn.type]}`}>
                                            {txn.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-zinc-400">
                                        {txn.account}
                                    </td>
                                    <td className={`whitespace-nowrap px-6 py-4 text-right text-sm font-semibold ${txn.type === "income" || txn.type === "refund"
                                            ? "text-emerald-400"
                                            : txn.type === "transfer"
                                                ? "text-blue-400"
                                                : "text-red-400"
                                        }`}>
                                        {txn.type === "income" || txn.type === "refund" ? "+" : txn.type === "expense" ? "-" : ""}
                                        ${txn.amount.toFixed(2)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Summary Footer */}
                <div className="flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 text-sm backdrop-blur-sm">
                    <span className="text-zinc-400">
                        Showing {sampleTransactions.length} transactions
                    </span>
                    <div className="flex gap-6">
                        <span className="text-emerald-400">Income: $5,300.00</span>
                        <span className="text-red-400">Expenses: $287.75</span>
                        <span className="text-blue-400">Transfers: $1,000.00</span>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
