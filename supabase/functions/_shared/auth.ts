import { createAdminClient } from "./supabase-admin.ts";

export type LedgerRole = "owner" | "admin" | "editor" | "viewer";

/** Result of authenticating + checking ledger membership. */
export interface AuthContext {
    userId: string;
    ledgerId: string;
    role: LedgerRole;
}

/**
 * Extracts user ID from the JWT in the Authorization header.
 * Returns null if the token is missing or invalid.
 */
export async function getUserId(authHeader: string | null): Promise<string | null> {
    if (!authHeader) return null;
    const admin = createAdminClient();
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user.id;
}

/**
 * Full auth check: validates JWT, checks ledger membership, and returns context.
 * Throws a structured error if any check fails.
 */
export async function requireAuth(
    authHeader: string | null,
    ledgerId: string,
    requiredRoles?: LedgerRole[]
): Promise<AuthContext> {
    const userId = await getUserId(authHeader);
    if (!userId) {
        throw { status: 401, message: "Unauthorized: invalid or missing token" };
    }

    const admin = createAdminClient();
    const { data: member, error } = await admin
        .from("ledger_members")
        .select("role")
        .eq("ledger_id", ledgerId)
        .eq("user_id", userId)
        .single();

    if (error || !member) {
        throw { status: 403, message: "Forbidden: not a member of this ledger" };
    }

    const role = member.role as LedgerRole;

    if (requiredRoles && !requiredRoles.includes(role)) {
        throw {
            status: 403,
            message: `Forbidden: requires role ${requiredRoles.join("|")}, you have ${role}`,
        };
    }

    return { userId, ledgerId, role };
}

/**
 * Validates a cron-secret header for scheduled calls (no user JWT needed).
 */
export function requireCronSecret(req: Request): void {
    const expected = Deno.env.get("X_CRON_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (!expected || provided !== expected) {
        throw { status: 401, message: "Unauthorized: invalid cron secret" };
    }
}
