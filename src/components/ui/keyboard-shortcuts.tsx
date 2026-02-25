"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

const SHORTCUTS = [
    { key: "n", label: "New transaction", route: "/transactions/new" },
    { key: "d", label: "Dashboard", route: "/dashboard" },
    { key: "t", label: "Transactions", route: "/transactions" },
    { key: "a", label: "Accounts", route: "/accounts" },
];

export function KeyboardShortcutsProvider() {
    const router = useRouter();
    const pathname = usePathname();
    const [showHelp, setShowHelp] = useState(false);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // Ignore if typing in an input/textarea/select
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
            // Ignore if modifier keys are held (except for ?)
            if (e.ctrlKey || e.metaKey || e.altKey) return;

            if (e.key === "?") {
                e.preventDefault();
                setShowHelp((v) => !v);
                return;
            }

            if (e.key === "Escape") {
                setShowHelp(false);
                return;
            }

            // Don't trigger shortcuts on auth pages
            if (pathname?.startsWith("/auth")) return;

            const shortcut = SHORTCUTS.find((s) => s.key === e.key.toLowerCase());
            if (shortcut && pathname !== shortcut.route) {
                e.preventDefault();
                router.push(shortcut.route);
            }
        },
        [router, pathname]
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    if (!showHelp) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowHelp(false)}>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl max-w-xs w-full" onClick={(e) => e.stopPropagation()}>
                <h2 className="text-lg font-semibold text-white mb-4">⌨️ Keyboard Shortcuts</h2>
                <div className="space-y-2">
                    {SHORTCUTS.map((s) => (
                        <div key={s.key} className="flex items-center justify-between">
                            <span className="text-sm text-zinc-400">{s.label}</span>
                            <kbd className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300">
                                {s.key.toUpperCase()}
                            </kbd>
                        </div>
                    ))}
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-800 mt-2">
                        <span className="text-sm text-zinc-400">Toggle this help</span>
                        <kbd className="rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-xs font-mono text-zinc-300">?</kbd>
                    </div>
                </div>
            </div>
        </div>
    );
}
