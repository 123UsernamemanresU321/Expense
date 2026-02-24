"use client";

import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { RequireAuth } from "@/lib/auth-context";

export function AppShell({ children }: { children: React.ReactNode }) {
    return (
        <RequireAuth>
            <div className="flex min-h-screen bg-zinc-950">
                <Sidebar />
                <div className="ml-60 flex-1">
                    <Topbar />
                    <main className="p-6">{children}</main>
                </div>
            </div>
        </RequireAuth>
    );
}
