"use client";

export default function ErrorPage({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            <div className="text-center max-w-md">
                <div className="text-5xl mb-4">⚠️</div>
                <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
                <p className="text-sm text-zinc-400 mb-6">
                    {error.message || "An unexpected error occurred. Please try again."}
                </p>
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={reset}
                        className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
                    >
                        Try Again
                    </button>
                    <a
                        href="/dashboard"
                        className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700"
                    >
                        Go to Dashboard
                    </a>
                </div>
            </div>
        </div>
    );
}
