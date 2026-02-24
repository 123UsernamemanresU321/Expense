"use client";

import { useState } from "react";
import Link from "next/link";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { supabase } = await import("@/lib/supabase/client");
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
            window.location.href = `${basePath}/dashboard/`;
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Login failed";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-500/10 blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="mb-8 text-center">
                    <Link href="/" className="inline-block text-4xl mb-2">💰</Link>
                    <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Welcome back</h1>
                    <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>Sign in to your account</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4 rounded-2xl p-8 themed-card">
                    {error && (
                        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)" }}>
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Email</label>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full themed-input" placeholder="you@example.com" />
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>Password</label>
                        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full themed-input" placeholder="••••••••" />
                    </div>

                    <button type="submit" disabled={loading} className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed">
                        {loading ? "Signing in..." : "Sign In"}
                    </button>

                    <div className="flex items-center justify-between text-sm" style={{ color: "var(--text-muted)" }}>
                        <Link href="/auth/reset" className="transition-colors" style={{ color: "var(--accent)" }}>Forgot password?</Link>
                        <Link href="/auth/register" className="transition-colors" style={{ color: "var(--accent)" }}>Create account</Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
