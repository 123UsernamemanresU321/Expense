"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button, Badge } from "@/components/ui/modal";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth-context";
import { getRules, createRule, deleteRule, testRules, applyRules } from "@/lib/api/rules";
import { createExport, pollExportJob } from "@/lib/api/exports";
import { uploadAndCreateJob, processImportJob, pollImportJob } from "@/lib/api/imports";
import { getNotifications, markAllRead, dismiss } from "@/lib/api/notifications";
import { CURRENCIES as ALL_CURRENCIES } from "@/lib/api/exchange-rates";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/errors";
import type { ClassificationRule, Notification } from "@/types/database";

// ─── Settings ────────────────────────────────────────────────────────

export default function SettingsPage() {
    const { user, ledger, role, canWrite, isOwnerOrAdmin, signOut } = useAuth();
    const [tab, setTab] = useState<"rules" | "export" | "import" | "audit" | "ocr" | "notifications">("rules");
    const [currency, setCurrency] = useState(ledger?.currency_code ?? "USD");
    const [saving, setSaving] = useState(false);
    const [currSearch, setCurrSearch] = useState("");

    useEffect(() => { if (ledger) setCurrency(ledger.currency_code); }, [ledger]);

    const handleCurrencyChange = async (newCurrency: string) => {
        if (!ledger) return;
        setCurrency(newCurrency);
        setSaving(true);
        await supabase.from("ledgers").update({ currency_code: newCurrency }).eq("id", ledger.id);
        toast("Main currency updated — dashboard and analytics will use " + newCurrency, "success");
        setSaving(false);
    };

    const filteredCurrencies = ALL_CURRENCIES.filter(
        (c) => !currSearch || c.code.includes(currSearch.toUpperCase()) || c.name.toLowerCase().includes(currSearch.toLowerCase())
    );

    return (
        <AppShell>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Settings</h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-tertiary)" }}>Your role: <Badge color={role === "owner" ? "emerald" : role === "admin" ? "blue" : "zinc"}>{role ?? "—"}</Badge></p>

            {/* Profile + Currency */}
            <div className="rounded-2xl p-6 mb-6 themed-card">
                <h2 className="text-lg font-semibold mb-3" style={{ color: "var(--text-primary)" }}>Profile & Ledger</h2>
                <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Email: <span style={{ color: "var(--text-primary)" }}>{user?.email}</span></p>
                <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>Ledger: <span style={{ color: "var(--text-primary)" }}>{ledger?.name ?? "—"}</span></p>

                <div className="mt-4">
                    <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                        Main Currency <span className="text-xs text-zinc-500">(used for dashboard & analytics)</span>
                    </label>
                    <input
                        type="text"
                        placeholder="Search currencies..."
                        value={currSearch}
                        onChange={(e) => setCurrSearch(e.target.value)}
                        className="mb-2 w-full max-w-xs rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                    />
                    <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-800 max-w-xs">
                        {filteredCurrencies.map((c) => (
                            <button
                                key={c.code}
                                type="button"
                                disabled={saving || !isOwnerOrAdmin}
                                onClick={() => { handleCurrencyChange(c.code); setCurrSearch(""); }}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-zinc-700 disabled:opacity-50 ${currency === c.code ? "bg-emerald-900/30 text-emerald-400" : "text-zinc-300"}`}
                            >
                                <span>{c.flag}</span>
                                <span className="font-medium">{c.code}</span>
                                <span className="text-zinc-500 text-xs">{c.name}</span>
                                {currency === c.code && <span className="ml-auto text-xs">✓</span>}
                            </button>
                        ))}
                    </div>
                    {saving && <span className="text-xs mt-1 block" style={{ color: "var(--text-muted)" }}>Saving...</span>}
                </div>

                <Button variant="danger" size="sm" className="mt-4" onClick={signOut}>Sign Out</Button>
            </div>

            {/* Tab Bar */}
            <div className="flex gap-1 rounded-xl p-1 mb-6 overflow-x-auto" style={{ background: "var(--bg-secondary)" }}>
                {(["rules", "export", "import", "audit", "ocr", "notifications"] as const).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className="rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors" style={tab === t ? { background: "var(--bg-tertiary)", color: "var(--text-primary)" } : { color: "var(--text-tertiary)" }}>{t}</button>
                ))}
            </div>

            {tab === "rules" && <RulesTab />}
            {tab === "export" && <ExportTab />}
            {tab === "import" && <ImportTab />}
            {tab === "audit" && <AuditTab />}
            {tab === "ocr" && <OcrTab />}
            {tab === "notifications" && <NotificationsTab />}
        </AppShell>
    );
}

// ─── Rules Tab ───────────────────────────────────────────────────────
function RulesTab() {
    const { ledger, canWrite } = useAuth();
    const [rules, setRules] = useState<ClassificationRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [testResult, setTestResult] = useState<{ matched: number; total: number; sample: { description: string; pattern: string }[] } | null>(null);
    const [applying, setApplying] = useState(false);

    const load = async () => { if (!ledger) return; setLoading(true); setRules(await getRules(ledger.id).catch(() => [])); setLoading(false); };
    useEffect(() => { load(); }, [ledger]);

    const handleTest = async () => { if (!ledger) return; const r = await testRules(ledger.id); if (r.error) { toast(r.error, "error"); return; } setTestResult({ matched: r.data?.matched ?? 0, total: r.data?.total_transactions ?? 0, sample: r.data?.sample?.map((s: { description: string; pattern: string }) => ({ description: s.description, pattern: s.pattern })) ?? [] }); };
    const handleApply = async () => { if (!ledger) return; setApplying(true); const r = await applyRules(ledger.id); if (r.error) toast(r.error, "error"); else toast(`Applied to ${r.data?.applied ?? 0} transactions`, "success"); setApplying(false); setTestResult(null); };

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold text-white">🤖 Classification Rules</h2>
                <div className="flex gap-2">{canWrite && <Button variant="secondary" size="sm" onClick={handleTest}>Test Rules</Button>}{canWrite && <Button size="sm" onClick={handleApply} disabled={applying}>{applying ? "Applying..." : "Apply Rules"}</Button>}</div>
            </div>
            {testResult && (
                <div className="mb-4 rounded-xl border border-emerald-800/50 bg-emerald-950/30 p-4">
                    <p className="text-sm text-emerald-300 mb-2">Test: {testResult.matched}/{testResult.total} transactions matched</p>
                    {testResult.sample.slice(0, 5).map((s, i) => <p key={i} className="text-xs text-zinc-400">• &quot;{s.description}&quot; → pattern: {s.pattern}</p>)}
                </div>
            )}
            {loading ? <TableSkeleton rows={3} /> : rules.length === 0 ? <EmptyState icon="🤖" title="No rules" description="Create rules to auto-categorize transactions" /> : (
                <div className="space-y-2">{rules.map((r) => (
                    <div key={r.id} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-3">
                        <div><p className="text-sm font-medium text-white">{r.match_field}: <span className="font-mono text-emerald-400">{r.match_pattern}</span></p><p className="text-xs text-zinc-500">Priority: {r.priority}</p></div>
                        {canWrite && <Button variant="ghost" size="sm" onClick={async () => { await deleteRule(r.id); toast("Deleted", "info"); load(); }}>🗑️</Button>}
                    </div>
                ))}</div>
            )}
        </div>
    );
}

// ─── Export Tab ───────────────────────────────────────────────────────
function ExportTab() {
    const { ledger } = useAuth();
    const [exporting, setExporting] = useState(false);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

    const handleExport = async () => {
        if (!ledger) return;
        setExporting(true); setDownloadUrl(null);
        const r = await createExport(ledger.id);
        if (r.error) { toast(r.error, "error"); setExporting(false); return; }
        if (r.data?.signed_url) { setDownloadUrl(r.data.signed_url); toast("Export ready!", "success"); }
        else toast("Export completed", "success");
        setExporting(false);
    };

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">📦 Export Data</h2>
            <p className="text-sm text-zinc-400 mb-4">Download your transactions, budgets, and categories as CSV/JSON.</p>
            <Button onClick={handleExport} disabled={exporting}>{exporting ? "Generating..." : "Generate Export Pack"}</Button>
            {downloadUrl && <a href={downloadUrl} target="_blank" rel="noreferrer" className="ml-4 text-sm text-emerald-400 hover:text-emerald-300">⬇ Download</a>}
        </div>
    );
}

// ─── Import Tab ──────────────────────────────────────────────────────
function ImportTab() {
    const { ledger } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ imported: number; skipped: number; errors: number } | null>(null);

    const handleImport = async () => {
        if (!ledger || !file) return;
        setImporting(true); setResult(null);
        try {
            const job = await uploadAndCreateJob(ledger.id, file);
            const r = await processImportJob(job.id);
            if (r.error) { toast(r.error, "error"); } else { setResult({ imported: r.data?.imported ?? 0, skipped: r.data?.skipped ?? 0, errors: r.data?.errors ?? 0 }); toast("Import complete!", "success"); }
        } catch { toast("Import failed", "error"); }
        setImporting(false);
    };

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">📥 Import CSV</h2>
            <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mb-4 text-sm text-zinc-400 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-4 file:py-2 file:text-sm file:text-white file:cursor-pointer" />
            <div><Button onClick={handleImport} disabled={importing || !file}>{importing ? "Importing..." : "Upload & Process"}</Button></div>
            {result && (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4 text-sm">
                    <p className="text-emerald-400">✅ Imported: {result.imported}</p>
                    <p className="text-zinc-400">⏭ Skipped: {result.skipped}</p>
                    {result.errors > 0 && <p className="text-red-400">❌ Errors: {result.errors}</p>}
                </div>
            )}
        </div>
    );
}

// ─── Audit Tab ───────────────────────────────────────────────────────
function AuditTab() {
    const { ledger } = useAuth();
    const [logs, setLogs] = useState<{ id: string; action: string; table_name: string; created_at: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ledger) return;
        setLoading(true);
        supabase.from("audit_logs").select("id, action, table_name, created_at").eq("ledger_id", ledger.id).order("created_at", { ascending: false }).limit(50).then(({ data }) => { setLogs(data ?? []); setLoading(false); });
    }, [ledger]);

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">📋 Audit Trail</h2>
            {loading ? <TableSkeleton rows={5} /> : logs.length === 0 ? <EmptyState icon="📋" title="No audit logs" /> : (
                <div className="space-y-2">{logs.map((l) => (
                    <div key={l.id} className="flex items-center justify-between rounded-xl bg-zinc-800/30 px-4 py-2">
                        <div className="flex items-center gap-3"><Badge color="blue">{l.action}</Badge><span className="text-sm text-zinc-300">{l.table_name}</span></div>
                        <span className="text-xs text-zinc-500">{new Date(l.created_at).toLocaleString()}</span>
                    </div>
                ))}</div>
            )}
        </div>
    );
}

// ─── OCR Tab ─────────────────────────────────────────────────────────
function OcrTab() {
    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">📸 OCR Pipeline</h2>
            <EmptyState icon="📸" title="Coming soon" description="Upload receipts and the OCR worker will extract transaction data automatically." />
        </div>
    );
}

// ─── Notifications Tab ──────────────────────────────────────────────
function NotificationsTab() {
    const [notifs, setNotifs] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { setLoading(true); getNotifications().then(setNotifs).catch(() => { }).finally(() => setLoading(false)); }, []);

    return (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">🔔 Notifications</h2>
                <Button variant="secondary" size="sm" onClick={async () => { await markAllRead(); setNotifs((n) => n.map((x) => ({ ...x, is_read: true }))); toast("All read", "info"); }}>Mark all read</Button>
            </div>
            {loading ? <TableSkeleton rows={3} /> : notifs.length === 0 ? <EmptyState icon="🔔" title="No notifications" /> : (
                <div className="space-y-2">{notifs.map((n) => (
                    <div key={n.id} className={`rounded-xl px-4 py-3 ${n.is_read ? "bg-zinc-800/20" : "bg-zinc-800/50 border border-blue-800/30"}`}>
                        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-white">{n.title}</h3><Badge color={n.is_read ? "zinc" : "blue"}>{n.notification_type}</Badge></div>
                        {n.body && <p className="text-xs text-zinc-400 mt-1">{n.body}</p>}
                        {!n.dismissed_at && <Button variant="ghost" size="sm" className="mt-1" onClick={async () => { await dismiss(n.id); setNotifs((prev) => prev.filter((x) => x.id !== n.id)); }}>Dismiss</Button>}
                    </div>
                ))}</div>
            )}
        </div>
    );
}
