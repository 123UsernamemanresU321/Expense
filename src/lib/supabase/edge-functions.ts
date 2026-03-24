export interface EdgeFunctionResult<T = unknown> {
    data: T | null;
    error: string | null;
}

/**
 * Calls a Supabase Edge Function by name.
 * Explicitly retrieves and injects the user JWT.
 */
export async function callEdgeFunction<T = unknown>(
    functionName: string,
    body: Record<string, unknown>
): Promise<EdgeFunctionResult<T>> {
    try {
        const { supabase } = await import("./client");

        // Get the current session — if missing, the user is not logged in
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error(`[Ledgerly] Session retrieval error for ${functionName}:`, sessionError.message);
        }

        if (!session?.access_token) {
            console.error(`[Ledgerly] No active session when calling ${functionName}. User may not be authenticated.`);
            return { data: null, error: "Not authenticated — please sign in again." };
        }

        // Inject the token into the body so it doesn't get stripped by Proxies
        const bodyWithToken = {
            ...body,
            _user_jwt: session.access_token,
        };

        const { data, error } = await supabase.functions.invoke(functionName, {
            body: bodyWithToken,
            headers: {
                Authorization: `Bearer ${session.access_token}`,
                "x-user-jwt": session.access_token,
            },
        });

        if (error) {
            console.error(`[Ledgerly] 🚨 Edge Function ${functionName} failed:`, error);
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

