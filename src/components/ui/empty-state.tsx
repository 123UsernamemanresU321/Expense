export function EmptyState({
    icon = "📭",
    title,
    description,
    action,
}: {
    icon?: string;
    title: string;
    description?: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/30 px-8 py-16 text-center">
            <span className="text-5xl">{icon}</span>
            <h3 className="mt-4 text-lg font-semibold text-white">{title}</h3>
            {description && (
                <p className="mt-1 max-w-md text-sm text-zinc-400">{description}</p>
            )}
            {action && <div className="mt-6">{action}</div>}
        </div>
    );
}

export function Skeleton({ className = "" }: { className?: string }) {
    return (
        <div
            className={`animate-pulse rounded-xl bg-zinc-800/50 ${className}`}
        />
    );
}

export function CardSkeleton() {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="mb-2 h-8 w-32" />
            <Skeleton className="h-3 w-20" />
        </div>
    );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div className="space-y-3">
            {Array.from({ length: rows }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
            ))}
        </div>
    );
}
