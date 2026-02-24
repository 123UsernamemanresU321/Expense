"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegisterPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");
    const [inviteCode, setInviteCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Check invite code
        const requiredCode = process.env.NEXT_PUBLIC_INVITE_CODE;
        if (requiredCode && inviteCode !== requiredCode) {
            setError("Invalid invite code. Only approved users can create accounts.");
            setLoading(false);
            return;
        }

        try {
            const { supabase } = await import("@/lib/supabase/client");
            const { error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: { display_name: displayName },
                },
            });
            if (error) throw error;
            setSuccess(true);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Registration failed";
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
                <div className="w-full max-w-md rounded-2xl p-8 text-center themed-card">
                    <div className="mb-4 text-5xl">✉️</div>
                    <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Check your email</h1>
                    <p className="mt-2 text-sm" style={{ color: "var(--text-tertiary)" }}>
                        We sent a confirmation link to <strong style={{ color: "var(--text-primary)" }}>{email}</strong>. Click the link to activate your account.
                    </p>
                    <Link
                        href="/auth/login"
                        className="mt-6 inline-block text-sm transition-colors"
                        style={{ color: "var(--accent)" }}
                    >
                        ← Back to login
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center px-4" style={{ background: "var(--bg-primary)" }}>
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-teal-500/10 blur-3xl" />
            </div>

            <div className="relative z-10 w-full max-w-md">
                <div className="mb-8 text-center">
                    <Link href="/" className="inline-block text-4xl mb-2">💰</Link>
                    <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Create your account</h1>
                    <p className="mt-1 text-sm" style={{ color: "var(--text-tertiary)" }}>An invite code is required to register</p>
                </div>

                <form
                    onSubmit={handleRegister}
                    className="space-y-4 rounded-2xl p-8 themed-card"
                >
                    {error && (
                        <div className="rounded-lg px-4 py-3 text-sm" style={{ background: "var(--danger-bg)", border: "1px solid var(--danger-border)", color: "var(--danger)" }}>
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="inviteCode" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                            Invite Code 🔑
                        </label>
                        <input
                            id="inviteCode"
                            type="text"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value)}
                            required
                            className="w-full themed-input"
                            placeholder="Enter your invite code"
                        />
                    </div>

                    <div>
                        <label htmlFor="displayName" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                            Name
                        </label>
                        <input
                            id="displayName"
                            type="text"
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            required
                            className="w-full themed-input"
                            placeholder="Alice"
                        />
                    </div>

                    <div>
                        <label htmlFor="email" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full themed-input"
                            placeholder="alice@example.com"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="mb-1.5 block text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={8}
                            className="w-full themed-input"
                            placeholder="Minimum 8 characters"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Creating account..." : "Create Account"}
                    </button>

                    <p className="text-center text-sm" style={{ color: "var(--text-muted)" }}>
                        Already have an account?{" "}
                        <Link href="/auth/login" className="transition-colors" style={{ color: "var(--accent)" }}>
                            Sign in
                        </Link>
                    </p>
                </form>
            </div>
        </div>
    );
}
