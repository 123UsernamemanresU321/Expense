"use client";

import { useState } from "react";
import Link from "next/link";

export default function ResetPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sent, setSent] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { supabase } = await import("@/lib/supabase");
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/auth/login`,
            });
            if (error) throw error;
            setSent(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Failed to send reset email";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (sent) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
                <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/50 p-8 text-center backdrop-blur-sm">
                    <div className="mb-4 text-5xl">📧</div>
                    <h1 className="text-xl font-bold text-white">Reset link sent</h1>
                    <p className="mt-2 text-sm text-zinc-400">
                        Check your inbox at <strong className="text-white">{email}</strong> for the password reset link.
                    </p>
                    <Link
                        href="/auth/login"
                        className="mt-6 inline-block text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                        ← Back to login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-500/10 blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="mb-8 text-center">
                    <Link href="/" className="inline-block text-4xl mb-2">💰</Link>
                    <h1 className="text-2xl font-bold text-white">Reset your password</h1>
                    <p className="mt-1 text-sm text-zinc-400">
                        Enter your email and we&apos;ll send a reset link
                    </p>
                </div>

                <form
                    onSubmit={handleReset}
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

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Sending..." : "Send Reset Link"}
                    </button>

                    <p className="text-center text-sm text-zinc-500">
                        <Link href="/auth/login" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                            ← Back to login
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
