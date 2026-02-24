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
    try {
        const { supabase } = await import("./client");
        const { data, error } = await supabase.functions.invoke(functionName, {
            body: body,
        });

        if (error) {
            return { data: null, error: error.message || "Edge function failed" };
        }

        return { data: data as T, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Network error",
        };
    }
}
