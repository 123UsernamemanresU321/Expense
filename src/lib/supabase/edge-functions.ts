import { getAccessToken } from "./client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export interface EdgeFunctionResult<T = unknown> {
    data: T | null;
    error: string | null;
}

/**
 * Calls a Supabase Edge Function by name.
 * Injects the user JWT automatically.
 */
export async function callEdgeFunction<T = unknown>(
    functionName: string,
    body: Record<string, unknown>
): Promise<EdgeFunctionResult<T>> {
    const token = await getAccessToken();
    if (!token) {
        return { data: null, error: "Not authenticated" };
    }

    const url = `${SUPABASE_URL}/functions/v1/${functionName}`;

    try {
        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const json = await res.json();

        if (!res.ok) {
            return { data: null, error: json.error ?? `HTTP ${res.status}` };
        }

        return { data: json as T, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Network error",
        };
    }
}
