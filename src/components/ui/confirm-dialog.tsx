"use client";

import { useEffect, useRef } from "react";
import { Button } from "./modal";

export function ConfirmDialog({
    open,
    onClose,
    onConfirm,
    title = "Are you sure?",
    message = "This action cannot be undone.",
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    variant = "danger",
}: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "primary";
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open) dialog.showModal();
        else dialog.close();
    }, [open]);

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            className="m-auto max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm"
        >
            <div className="p-6">
                <h2 className="text-lg font-semibold mb-2">{title}</h2>
                <p className="text-sm text-zinc-400 mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={variant === "danger" ? "danger" : "primary"}
                        size="sm"
                        onClick={() => { onConfirm(); onClose(); }}
                    >
                        {confirmLabel}
                    </Button>
                </div>
            </div>
        </dialog>
    );
}
