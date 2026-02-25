import Link from "next/link";

export default function NotFoundPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
            <div className="text-center max-w-md">
                <div className="text-6xl mb-4">🔍</div>
                <h1 className="text-3xl font-bold text-white mb-2">404 — Page Not Found</h1>
                <p className="text-sm text-zinc-400 mb-6">
                    The page you&apos;re looking for doesn&apos;t exist or has been moved.
                </p>
                <Link
                    href="/dashboard"
                    className="inline-block rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
                >
                    Back to Dashboard
                </Link>
            </div>
        </div>
    );
}
