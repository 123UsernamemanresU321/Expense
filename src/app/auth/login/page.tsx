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
            // Supabase auth will be connected in Phase 2
            // For now, redirect to dashboard
            const { supabase } = await import("@/lib/supabase/client");
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
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
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="mb-8 text-center">
                    <Link href="/" className="inline-block text-4xl mb-2">💰</Link>
                    <h1 className="text-2xl font-bold text-white">Welcome back</h1>
                    <p className="mt-1 text-sm text-zinc-400">Sign in to your account</p>
                </div>

                <form
                    onSubmit={handleLogin}
                    className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm"
                >
                    {error && (
                        <div className="rounded-lg border border-red-800/50 bg-red-950/50 px-4 py-3 text-sm text-red-400">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-zinc-300">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="alice@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-zinc-300">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="flex items-center justify-between text-sm">
                        <label className="flex items-center gap-2 text-zinc-400">
                            <input type="checkbox" className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500" />
                            Remember me
                        </label>
                        <Link href="/auth/reset" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                            Forgot password?
                        </Link>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Signing in..." : "Sign In"}
                    </button>

                    <p className="text-center text-sm text-zinc-500">
                        Don&apos;t have an account?{" "}
                        <Link href="/auth/register" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                            Sign up
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
