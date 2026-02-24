"use client";

import { AppShell } from "@/components/layout/app-shell";

const stats = [
    { label: "Total Balance", value: "$18,800.00", change: "+2.4%", icon: "💰", color: "emerald" },
    { label: "Monthly Income", value: "$5,300.00", change: "+12.5%", icon: "📈", color: "teal" },
    { label: "Monthly Expenses", value: "$287.75", change: "-8.3%", icon: "📉", color: "cyan" },
    { label: "Active Budgets", value: "1", change: "On track", icon: "🎯", color: "violet" },
];

export default function DashboardPage() {
    return (
        <AppShell>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                        Overview of your financial health
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {stats.map((stat) => (
                        <div
                            key={stat.label}
                            className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm transition-all hover:border-zinc-700 hover:bg-zinc-900/80"
                        >
                            <div className="absolute -right-4 -top-4 text-6xl opacity-10 transition-transform group-hover:scale-110">
                                {stat.icon}
                            </div>
                            <p className="text-sm font-medium text-zinc-400">{stat.label}</p>
                            <p className="mt-2 text-2xl font-bold text-white">{stat.value}</p>
                            <p className={`mt-1 text-xs font-medium ${stat.change.startsWith("+") ? "text-emerald-400" :
                                    stat.change.startsWith("-") ? "text-red-400" : "text-zinc-400"
                                }`}>
                                {stat.change}
                            </p>
                        </div>
                    ))}
                </div>

                {/* Quick Actions + Recent Transactions */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                    {/* Recent Transactions */}
                    <div className="col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Recent Transactions</h2>
                            <a href="/transactions" className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors">
                                View all →
                            </a>
                        </div>
                        <div className="space-y-3">
                            {[
                                { desc: "February salary", amount: "+$4,500.00", icon: "💰", type: "income", date: "Feb 1" },
                                { desc: "Weekly groceries", amount: "-$127.50", icon: "🛒", type: "expense", date: "Feb 3" },
                                { desc: "Uber to airport", amount: "-$24.50", icon: "🚗", type: "expense", date: "Feb 4" },
                                { desc: "Transfer to savings", amount: "$1,000.00", icon: "🔄", type: "transfer", date: "Feb 5" },
                                { desc: "Refund — damaged goods", amount: "+$45.00", icon: "↩️", type: "refund", date: "Feb 8" },
                            ].map((txn, i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between rounded-xl border border-zinc-800/50 bg-zinc-800/30 px-4 py-3 transition-all hover:bg-zinc-800/50"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-xl">{txn.icon}</span>
                                        <div>
                                            <p className="text-sm font-medium text-zinc-200">{txn.desc}</p>
                                            <p className="text-xs text-zinc-500">{txn.date}</p>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-semibold ${txn.type === "income" || txn.type === "refund" ? "text-emerald-400" :
                                            txn.type === "transfer" ? "text-zinc-400" : "text-red-400"
                                        }`}>
                                        {txn.amount}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Stats Sidebar */}
                    <div className="space-y-4">
                        {/* Budget Card */}
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
                            <h3 className="text-sm font-semibold text-zinc-400 mb-4">Food Budget</h3>
                            <div className="flex items-end justify-between mb-2">
                                <span className="text-2xl font-bold text-white">$287.75</span>
                                <span className="text-sm text-zinc-400">/ $500</span>
                            </div>
                            <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                                <div className="h-full w-[57%] rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all" />
                            </div>
                            <p className="mt-2 text-xs text-zinc-500">57% used • $212.25 remaining</p>
                        </div>

                        {/* Upcoming Subscriptions */}
                        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 backdrop-blur-sm">
                            <h3 className="text-sm font-semibold text-zinc-400 mb-4">Upcoming</h3>
                            <div className="space-y-3">
                                {[
                                    { name: "Netflix", amount: "$15.99", date: "Mar 1" },
                                    { name: "Gym", amount: "$49.99", date: "Mar 1" },
                                    { name: "Spotify", amount: "$9.99", date: "Mar 5" },
                                ].map((sub) => (
                                    <div key={sub.name} className="flex items-center justify-between text-sm">
                                        <span className="text-zinc-300">{sub.name}</span>
                                        <div className="text-right">
                                            <span className="text-zinc-200">{sub.amount}</span>
                                            <p className="text-xs text-zinc-500">{sub.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </AppShell>
    );
}
