import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Creates a Supabase admin client using the service role key.
 * ONLY use inside Edge Functions — never expose the service role key.
 */
export function createAdminClient(): SupabaseClient {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    return createClient(url, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

/**
 * Creates a Supabase client that inherits the caller's JWT
 * (so RLS is applied as the calling user).
 */
export function createUserClient(authHeader: string): SupabaseClient {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    return createClient(url, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
