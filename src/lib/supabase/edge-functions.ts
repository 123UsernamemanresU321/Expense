export interface EdgeFunctionResult<T = unknown> {
    data: T | null;
    error: string | null;
}

/**
 * Calls a Supabase Edge Function by name.
 * Uses direct fetch (not supabase.functions.invoke) to guarantee
 * the JWT reaches the function via multiple channels.
 */
export async function callEdgeFunction<T = unknown>(
    functionName: string,
    body: Record<string, unknown>
): Promise<EdgeFunctionResult<T>> {
    try {
        const { supabase } = await import("./client");

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

        // Get the current session — if missing, the user is not logged in
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
            console.error(`[Ledgerly] Session retrieval error for ${functionName}:`, sessionError.message);
        }

        if (!session?.access_token) {
            console.error(`[Ledgerly] No active session when calling ${functionName}. User may not be authenticated.`);
            return { data: null, error: "Not authenticated — please sign in again." };
        }

        const url = `${supabaseUrl}/functions/v1/${functionName}`;

        // Send the JWT through multiple channels for maximum reliability
        const bodyWithToken = {
            ...body,
            _user_jwt: session.access_token,
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${session.access_token}`,
                "apikey": supabaseAnonKey,
                "x-user-jwt": session.access_token,
            },
            body: JSON.stringify(bodyWithToken),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[Ledgerly] 🚨 Edge Function ${functionName} failed (${response.status}):`, errorBody);
            try {
                const parsed = JSON.parse(errorBody);
                return { data: null, error: parsed.error || parsed.message || `HTTP ${response.status}` };
            } catch {
                return { data: null, error: errorBody || `HTTP ${response.status}` };
            }
        }

        const data = await response.json();
        return { data: data as T, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Network error",
        };
    }
}

