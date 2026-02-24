"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4">
      {/* Background gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-teal-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 text-center">
        <div className="mb-6 text-6xl">💰</div>
        <h1 className="mb-4 bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400 bg-clip-text text-5xl font-bold tracking-tight text-transparent">
          FinanceHub
        </h1>
        <p className="mb-8 max-w-md text-lg text-zinc-400">
          Your personal finance dashboard. Track expenses, manage budgets, and
          gain insights into your spending habits.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all hover:shadow-xl hover:shadow-emerald-500/30 hover:-translate-y-0.5"
          >
            Sign In
          </Link>
          <Link
            href="/auth/register"
            className="inline-flex items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900 px-8 py-3 text-sm font-semibold text-zinc-300 transition-all hover:border-zinc-600 hover:bg-zinc-800 hover:text-white"
          >
            Create Account
          </Link>
        </div>
      </div>

      <footer className="absolute bottom-6 text-xs text-zinc-600">
        Built with Next.js + Supabase • Phase 1 Schema Contract
      </footer>
    </div>
  );
}
