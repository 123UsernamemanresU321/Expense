"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "@/lib/theme-context";

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
    const { theme, toggle } = useTheme();

    return (
        <aside
            className={`fixed left-0 top-0 z-40 flex h-screen flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-60"}`}
            style={{ background: "var(--bg-secondary)", borderRight: "1px solid var(--border)" }}
        >
            {/* Logo */}
            <div className="flex h-16 shrink-0 items-center justify-between px-4" style={{ borderBottom: "1px solid var(--border)" }}>
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
                    className="rounded-lg p-1.5 transition-colors"
                    style={{ color: "var(--text-muted)" }}
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
                                    ? "text-emerald-500 dark:text-emerald-400"
                                    : ""
                                    }`}
                                style={isActive
                                    ? { background: "var(--accent-bg)" }
                                    : { color: "var(--text-tertiary)" }
                                }
                            >
                                <span className="text-lg shrink-0">{item.icon}</span>
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </div>
            </nav>

            {/* Footer: Theme toggle */}
            <div className="shrink-0 px-3 py-3" style={{ borderTop: "1px solid var(--border)" }}>
                <button
                    onClick={toggle}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                    style={{ color: "var(--text-tertiary)" }}
                    title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                >
                    <span className="text-lg">{theme === "dark" ? "☀️" : "🌙"}</span>
                    {!collapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
                </button>
                {!collapsed && (
                    <p className="mt-1 px-3 text-xs" style={{ color: "var(--text-muted)" }}>FinanceHub v0.1</p>
                )}
            </div>
        </aside>
    );
}
