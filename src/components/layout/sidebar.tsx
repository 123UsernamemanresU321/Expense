"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: "📊" },
    { href: "/transactions", label: "Transactions", icon: "💳" },
    { href: "/accounts", label: "Accounts", icon: "🏦" },
    { href: "/budgets", label: "Budgets", icon: "🎯" },
    { href: "/categories", label: "Categories", icon: "📁" },
    { href: "/subscriptions", label: "Subscriptions", icon: "🔄" },
    { href: "/analytics", label: "Analytics", icon: "📈" },
    { href: "/shared", label: "Shared", icon: "👥" },
    { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-zinc-800 bg-zinc-950 transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
        >
            {/* Logo */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
                {!collapsed && (
                    <Link href="/dashboard" className="flex items-center gap-2">
                        <span className="text-xl">💰</span>
                        <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-lg font-bold text-transparent">
                            FinanceHub
                        </span>
                    </Link>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? "→" : "←"}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-4">
                <div className="flex flex-col gap-1">
                    {navItems.map((item) => {
                        const isActive = pathname?.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                title={collapsed ? item.label : undefined}
                                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${isActive
                                        ? "bg-emerald-950/50 text-emerald-400 shadow-sm shadow-emerald-500/10"
                                        : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                                    }`}
                            >
                                <span className="text-lg shrink-0">{item.icon}</span>
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Footer */}
            {!collapsed && (
                <div className="shrink-0 border-t border-zinc-800 px-4 py-3">
                    <p className="text-xs text-zinc-500">FinanceHub v0.1</p>
                </div>
            )}
        </aside>
    );
}
