"use client";

export function Topbar() {
    return (
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
            <div>
                <h2 className="text-sm font-medium text-zinc-400 dark:text-zinc-500">
                    Personal Finance Dashboard
                </h2>
            </div>
            <div className="flex items-center gap-4">
                {/* Notifications placeholder */}
                <button
                    className="relative rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    aria-label="Notifications"
                >
                    🔔
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                        2
                    </span>
                </button>
                {/* Profile placeholder */}
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-bold">
                        A
                    </div>
                </div>
            </div>
        </header>
    );
}
