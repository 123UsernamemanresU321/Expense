"use client";

import { useAuth } from "@/lib/auth-context";

export function Topbar() {
    const { user, signOut, ledger } = useAuth();

    return (
        <header
            className="sticky top-0 z-30 flex h-16 items-center justify-between px-6"
            style={{
                background: "var(--bg-primary)",
                borderBottom: "1px solid var(--border)",
                backdropFilter: "var(--glass-blur)",
            }}
        >
            <div>
                {ledger && (
                    <h2 className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                        📒 {ledger.name}
                        {ledger.currency_code && (
                            <span className="ml-2 text-xs" style={{ color: "var(--text-muted)" }}>({ledger.currency_code})</span>
                        )}
                    </h2>
                )}
            </div>
            <div className="flex items-center gap-4">
                {user && (
                    <>
                        <span className="text-sm" style={{ color: "var(--text-tertiary)" }}>{user.email}</span>
                        <button
                            onClick={signOut}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                            style={{ color: "var(--text-tertiary)" }}
                        >
                            Sign Out
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}
