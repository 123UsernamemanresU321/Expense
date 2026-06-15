import type { Transaction } from "@/types/database";

const TRANSFER_IN_PATTERN = /\btransfer\s+in\b|\bfrom\b/;
const TRANSFER_OUT_PATTERN = /\btransfer\s+out\b|\bto\b/;

export function isTransactionPositive(txn: Pick<Transaction, "txn_type" | "description">): boolean {
    if (txn.txn_type === "income" || txn.txn_type === "refund") return true;
    if (txn.txn_type !== "transfer") return false;

    const description = (txn.description ?? "").toLowerCase();
    if (TRANSFER_IN_PATTERN.test(description)) return true;
    if (TRANSFER_OUT_PATTERN.test(description)) return false;
    return false;
}

export function transactionAmountSign(txn: Pick<Transaction, "txn_type" | "description">): "+" | "-" {
    return isTransactionPositive(txn) ? "+" : "-";
}
