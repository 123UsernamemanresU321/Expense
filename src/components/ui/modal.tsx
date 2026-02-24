"use client";

import { useEffect, useRef } from "react";

export function Modal({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open) {
            dialog.showModal();
        } else {
            dialog.close();
        }
    }, [open]);

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            className="m-auto max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
                <h2 className="text-lg font-semibold">{title}</h2>
                <button
                    onClick={onClose}
                    className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                    ✕
                </button>
            </div>
            <div className="px-6 py-4">{children}</div>
        </dialog>
    );
}

/** Standard button styles */
export function Button({
    children,
    variant = "primary",
    size = "md",
    disabled = false,
    onClick,
    type = "button",
    className = "",
}: {
    children: React.ReactNode;
    variant?: "primary" | "secondary" | "danger" | "ghost";
    size?: "sm" | "md";
    disabled?: boolean;
    onClick?: () => void;
    type?: "button" | "submit";
    className?: string;
}) {
    const base = "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed";
    const sizes = { sm: "px-3 py-1.5 text-xs", md: "px-4 py-2.5 text-sm" };
    const variants = {
        primary: "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30",
        secondary: "border border-zinc-700 bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
        danger: "bg-red-600 text-white hover:bg-red-700",
        ghost: "text-zinc-400 hover:bg-zinc-800 hover:text-white",
    };

    return (
        <button
            type={type}
            disabled={disabled}
            onClick={onClick}
            className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
        >
            {children}
        </button>
    );
}

/** Standard input field */
export function Input({
    label,
    id,
    ...props
}: { label: string; id: string } & React.InputHTMLAttributes<HTMLInputElement>) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-300">
                {label}
            </label>
            <input
                id={id}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                {...props}
            />
        </div>
    );
}

/** Standard select field */
export function Select({
    label,
    id,
    options,
    ...props
}: { label: string; id: string; options: { value: string; label: string }[] } & React.SelectHTMLAttributes<HTMLSelectElement>) {
    return (
        <div>
            <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-zinc-300">
                {label}
            </label>
            <select
                id={id}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                {...props}
            >
                {options.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                ))}
            </select>
        </div>
    );
}

/** Status badge */
export function Badge({
    children,
    color = "zinc",
}: {
    children: React.ReactNode;
    color?: "emerald" | "red" | "amber" | "blue" | "zinc" | "purple";
}) {
    const colors = {
        emerald: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
        red: "bg-red-950/50 text-red-400 border-red-800/50",
        amber: "bg-amber-950/50 text-amber-400 border-amber-800/50",
        blue: "bg-blue-950/50 text-blue-400 border-blue-800/50",
        zinc: "bg-zinc-800/50 text-zinc-400 border-zinc-700/50",
        purple: "bg-purple-950/50 text-purple-400 border-purple-800/50",
    };
    return (
        <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-medium ${colors[color]}`}>
            {children}
        </span>
    );
}
