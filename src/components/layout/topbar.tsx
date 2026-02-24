"use client";

import { useAuth } from "@/lib/auth-context";

export function Topbar() {
    const { user, signOut, ledger } = useAuth();

    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-800 bg-zinc-950/80 px-6 backdrop-blur-xl">
            <div>
                {ledger && (
                    <h2 className="text-sm font-medium text-zinc-300">
                        📒 {ledger.name}
                    </h2>
                )}
            </div>
            <div className="flex items-center gap-4">
                {user && (
                    <>
                        <span className="text-sm text-zinc-400">{user.email}</span>
                        <button
                            onClick={signOut}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
                        >
                            Sign Out
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}
