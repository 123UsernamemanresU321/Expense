"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/transactions", label: "Transactions", icon: "💳" },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={`fixed left-0 top-0 z-40 h-screen border-r border-zinc-200 bg-white transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-950 ${collapsed ? "w-16" : "w-64"
                }`}
        >
            {/* Logo */}
            <div className="flex h-16 items-center justify-between border-b border-zinc-200 px-4 dark:border-zinc-800">
                {!collapsed && (
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <span className="text-xl">💰</span>
                        <span className="text-lg font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">
                            FinanceHub
                        </span>
                    </Link>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? "→" : "←"}
                </button>
            </div>

            {/* Navigation */}
            <nav className="mt-4 flex flex-col gap-1 px-3">
                {navItems.map((item) => {
                    const isActive = pathname?.startsWith(item.href);
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive
                                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
                                    : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200"
                                }`}
                        >
                            <span className="text-lg">{item.icon}</span>
                            {!collapsed && <span>{item.label}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            {!collapsed && (
                <div className="absolute bottom-4 left-0 right-0 px-4">
                    <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-4 dark:from-emerald-950/30 dark:to-teal-950/30">
                        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            Phase 1 — Schema Locked ✅
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            DB contract finalized
                        </p>
                    </div>
                </div>
            )}
        </aside>
    );
}
