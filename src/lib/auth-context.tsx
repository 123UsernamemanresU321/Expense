"use client";

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type { LedgerRole, Ledger, LedgerMember } from "@/types/database";

// --- Types ---
interface AuthState {
    user: User | null;
    session: Session | null;
    loading: boolean;
}

interface LedgerContext {
    ledger: Ledger | null;
    role: LedgerRole | null;
    ledgers: Ledger[];
    memberships: LedgerMember[];
}

interface AuthContextValue extends AuthState, LedgerContext {
    signOut: () => Promise<void>;
    selectLedger: (id: string) => void;
    hasRole: (...roles: LedgerRole[]) => boolean;
    canWrite: boolean;
    isOwnerOrAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// --- Provider ---
export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [auth, setAuth] = useState<AuthState>({
        user: null,
        session: null,
        loading: true,
    });
    const [ledgerCtx, setLedgerCtx] = useState<LedgerContext>({
        ledger: null,
        role: null,
        ledgers: [],
        memberships: [],
    });
    const [selectedLedgerId, setSelectedLedgerId] = useState<string | null>(null);

    // Listen for auth state changes
    useEffect(() => {
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuth({ user: session?.user ?? null, session, loading: false });
        });

        // Initial session check
        supabase.auth.getSession().then(({ data: { session } }) => {
            setAuth({ user: session?.user ?? null, session, loading: false });
        });

        return () => subscription.unsubscribe();
    }, []);

    // Fetch ledgers when user is authenticated
    useEffect(() => {
        if (!auth.user) {
            setLedgerCtx({ ledger: null, role: null, ledgers: [], memberships: [] });
            return;
        }

        const fetchLedgers = async () => {
            // Fetch memberships (RLS filters to user's ledgers)
            const { data: memberships } = await supabase
                .from("ledger_members")
                .select("*, ledger:ledgers(*)")
                .eq("user_id", auth.user!.id);

            if (!memberships || memberships.length === 0) {
                setLedgerCtx({
                    ledger: null,
                    role: null,
                    ledgers: [],
                    memberships: [],
                });
                return;
            }

            const ledgers = memberships
                .map((m) => m.ledger as unknown as Ledger)
                .filter(Boolean);
            const mems = memberships.map(
                (m) =>
                ({
                    id: m.id,
                    ledger_id: m.ledger_id,
                    user_id: m.user_id,
                    role: m.role,
                    invited_by: m.invited_by,
                    created_at: m.created_at,
                    updated_at: m.updated_at,
                } as LedgerMember)
            );

            // Select ledger: use saved preference or first
            const savedId =
                selectedLedgerId ??
                (typeof window !== "undefined"
                    ? localStorage.getItem("selected_ledger")
                    : null);
            const targetId =
                savedId && ledgers.find((l) => l.id === savedId)
                    ? savedId
                    : ledgers[0]?.id;

            const activeLedger = ledgers.find((l) => l.id === targetId) ?? null;
            const activeMember = mems.find((m) => m.ledger_id === targetId) ?? null;

            setLedgerCtx({
                ledger: activeLedger,
                role: (activeMember?.role as LedgerRole) ?? null,
                ledgers,
                memberships: mems,
            });
        };

        fetchLedgers();
    }, [auth.user, selectedLedgerId]);

    const signOut = useCallback(async () => {
        await supabase.auth.signOut();
        if (typeof window !== "undefined") {
            localStorage.removeItem("selected_ledger");
            const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
            window.location.href = `${basePath}/`;
        }
    }, []);

    const selectLedger = useCallback((id: string) => {
        setSelectedLedgerId(id);
        if (typeof window !== "undefined") {
            localStorage.setItem("selected_ledger", id);
        }
    }, []);

    const hasRole = useCallback(
        (...roles: LedgerRole[]) => {
            return ledgerCtx.role !== null && roles.includes(ledgerCtx.role);
        },
        [ledgerCtx.role]
    );

    const value = useMemo<AuthContextValue>(
        () => ({
            ...auth,
            ...ledgerCtx,
            signOut,
            selectLedger,
            hasRole,
            canWrite: hasRole("owner", "admin", "editor"),
            isOwnerOrAdmin: hasRole("owner", "admin"),
        }),
        [auth, ledgerCtx, signOut, selectLedger, hasRole]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// --- Hook ---
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
}

// --- Route Guard Component ---
export function RequireAuth({
    children,
    roles,
    fallback,
}: {
    children: React.ReactNode;
    roles?: LedgerRole[];
    fallback?: React.ReactNode;
}) {
    const { user, loading, role } = useAuth();

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-zinc-950">
                <div className="animate-pulse text-zinc-400">Loading...</div>
            </div>
        );
    }

    if (!user) {
        if (typeof window !== "undefined") {
            const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
            window.location.href = `${basePath}/auth/login/`;
        }
        return null;
    }

    if (roles && role && !roles.includes(role)) {
        return (
            fallback ?? (
                <div className="flex min-h-screen items-center justify-center bg-zinc-950">
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-white">Access Denied</h2>
                        <p className="mt-2 text-sm text-zinc-400">
                            You need {roles.join(" or ")} role to view this page.
                        </p>
                    </div>
                </div>
            )
        );
    }

    return <>{children}</>;
}
