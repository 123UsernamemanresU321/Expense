"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { RequireAuth } from "@/lib/auth-context";

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <RequireAuth>
            <div className="flex min-h-screen" style={{ background: "var(--bg-primary)" }}>
                <Sidebar />
                {/* Desktop: offset by sidebar width. Mobile: full width */}
                <div className="w-full md:ml-60 flex-1 transition-all duration-300">
                    <Topbar />
                    <main className="p-4 md:p-6 pt-16 md:pt-6">{children}</main>
                </div>
            </div>
        </RequireAuth>
    );
}
