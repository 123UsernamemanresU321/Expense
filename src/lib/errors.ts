/** Standard error wrapper for all API operations */
export class ApiError extends Error {
    constructor(
        message: string,
        public code: string = "UNKNOWN",
        public status: number = 500
    ) {
        super(message);
        this.name = "ApiError";
    }
}

/** Show a toast notification (simple implementation using custom events) */
export function toast(
    message: string,
    type: "success" | "error" | "info" = "info"
) {
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("app:toast", { detail: { message, type } })
        );
    }
}

/** Wraps a Supabase query result, throwing ApiError on failure */
export function unwrap<T>(result: {
    data: T | null;
    error: { message: string; code?: string } | null;
}): T {
    if (result.error) {
        throw new ApiError(
            result.error.message,
            result.error.code ?? "SUPABASE_ERROR"
        );
    }
    return result.data as T;
}

/** Safe wrapper that catches errors, shows toast, and returns null */
export async function safe<T>(
    fn: () => Promise<T>,
    errorMessage = "Something went wrong"
): Promise<T | null> {
    try {
        return await fn();
    } catch (err) {
        const msg =
            err instanceof ApiError
                ? err.message
                : err instanceof Error
                    ? err.message
                    : errorMessage;
        toast(msg, "error");
        console.error("[API Error]", err);
        return null;
    }
}
