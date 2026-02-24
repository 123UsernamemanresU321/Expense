"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { Button, Badge, Modal, Input, Select } from "@/components/ui/modal";
import { useAuth } from "@/lib/auth-context";
import { getMembers, inviteMember, removeMember, closeMonth, reopenMonth, getMonthClosures } from "@/lib/api/shared";
import { toast } from "@/lib/errors";
import type { LedgerMember, LedgerRole, MonthClosure } from "@/types/database";

type MemberRow = LedgerMember & { profile?: { display_name: string; email: string } };

export default function SharedPage() {
    const { ledger, isOwnerOrAdmin } = useAuth();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [closures, setClosures] = useState<MonthClosure[]>([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteForm, setInviteForm] = useState({ user_id: "", role: "viewer" as LedgerRole });
    const [closeMonthVal, setCloseMonthVal] = useState(new Date().toISOString().slice(0, 7));

    const load = async () => {
        if (!ledger) return;
        setLoading(true);
        const [m, c] = await Promise.all([getMembers(ledger.id).catch(() => []), getMonthClosures(ledger.id).catch(() => [])]);
        setMembers(m); setClosures(c); setLoading(false);
    };
    useEffect(() => { load(); }, [ledger]);

    const roleColor: Record<string, "emerald" | "blue" | "amber" | "zinc"> = { owner: "emerald", admin: "blue", editor: "amber", viewer: "zinc" };

    return (
        <AppShell>
            <div className="mb-6"><h1 className="text-2xl font-bold text-white">Shared Ledger</h1><p className="text-sm text-zinc-400">Members & monthly close</p></div>
            <div className="grid gap-8 lg:grid-cols-2">
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                    <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">👥 Members</h2>{isOwnerOrAdmin && <Button size="sm" onClick={() => setShowInvite(true)}>+ Invite</Button>}</div>
                    {loading ? <TableSkeleton rows={3} /> : members.length === 0 ? <p className="text-sm text-zinc-500">No members</p> : (
                        <div className="space-y-2">{members.map((m) => (
                            <div key={m.id} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-3">
                                <div><p className="text-sm font-medium text-white">{m.profile?.display_name ?? m.user_id.slice(0, 8)}</p><p className="text-xs text-zinc-500">{m.profile?.email}</p></div>
                                <div className="flex items-center gap-2"><Badge color={roleColor[m.role] ?? "zinc"}>{m.role}</Badge>
                                    {isOwnerOrAdmin && m.role !== "owner" && <Button variant="ghost" size="sm" onClick={async () => { await removeMember(m.id); toast("Removed", "info"); load(); }}>Remove</Button>}</div>
                            </div>
                        ))}</div>
                    )}
                </div>
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
                    <h2 className="text-lg font-semibold text-white mb-4">🔒 Monthly Close</h2>
                    {isOwnerOrAdmin && (<div className="flex gap-3 mb-4"><input type="month" value={closeMonthVal} onChange={(e) => setCloseMonthVal(e.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white" /><Button size="sm" onClick={async () => { if (!ledger) return; await closeMonth(ledger.id, closeMonthVal); toast("Month closed", "success"); load(); }}>Close</Button></div>)}
                    {closures.length === 0 ? <p className="text-sm text-zinc-500">No months closed</p> : (
                        <div className="space-y-2">{closures.map((c) => (
                            <div key={c.id} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-3">
                                <p className="text-sm font-medium text-white">{c.year_month}</p>
                                {isOwnerOrAdmin && <Button variant="ghost" size="sm" onClick={async () => { if (!ledger) return; await reopenMonth(ledger.id, c.year_month); toast("Reopened", "info"); load(); }}>Reopen</Button>}
                            </div>
                        ))}</div>
                    )}
                </div>
            </div>
            <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Member">
                <div className="space-y-4">
                    <Input id="inv-uid" label="User ID" value={inviteForm.user_id} onChange={(e) => setInviteForm({ ...inviteForm, user_id: e.target.value })} placeholder="UUID" />
                    <Select id="inv-role" label="Role" value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as LedgerRole })} options={[{ value: "viewer", label: "Viewer" }, { value: "editor", label: "Editor" }, { value: "admin", label: "Admin" }]} />
                    <div className="flex gap-3 pt-2"><Button onClick={async () => { if (!ledger) return; await inviteMember(ledger.id, inviteForm.user_id, inviteForm.role); toast("Invited!", "success"); setShowInvite(false); load(); }}>Invite</Button><Button variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Button></div>
                </div>
            </Modal>
        </AppShell>
    );
}
