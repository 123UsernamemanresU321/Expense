"use client";

import { useEffect, useState } from "react";

interface ToastItem {
    id: number;
    message: string;
    type: "success" | "error" | "info";
}

let toastId = 0;

export function ToastContainer() {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    useEffect(() => {
        const handler = (e: Event) => {
            const { message, type } = (e as CustomEvent).detail;
            const id = ++toastId;
            setToasts((prev) => [...prev, { id, message, type }]);
            setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
        };
        window.addEventListener("app:toast", handler);
        return () => window.removeEventListener("app:toast", handler);
    }, []);

    if (toasts.length === 0) return null;

    const colors = {
        success: "border-emerald-700 bg-emerald-950/90 text-emerald-300",
        error: "border-red-700 bg-red-950/90 text-red-300",
        info: "border-zinc-700 bg-zinc-900/90 text-zinc-300",
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2">
            {toasts.map((t) => (
                <div
                    key={t.id}
                    className={`animate-slide-up rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur-sm ${colors[t.type]}`}
                >
                    {t.message}
                </div>
            ))}
        </div>
    );
}
