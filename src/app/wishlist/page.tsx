"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button, Badge } from "@/components/ui/modal";
import { EmptyState, TableSkeleton } from "@/components/ui/empty-state";
import { useAuth } from "@/lib/auth-context";
import { getWishlistItems, createWishlistItem, toggleWishlistItemSelection, deleteWishlistItem, type WishlistItem } from "@/lib/api/wishlist";
import { supabase } from "@/lib/supabase/client";
import { toast } from "@/lib/errors";
import { batchConvert, CURRENCIES as ALL_CURRENCIES } from "@/lib/api/exchange-rates";

export default function WishlistPage() {
    const { ledger, canWrite } = useAuth();
    const [items, setItems] = useState<WishlistItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [newItemName, setNewItemName] = useState("");
    const [newItemCost, setNewItemCost] = useState("");
    const [newItemCurrency, setNewItemCurrency] = useState(ledger?.currency_code ?? "USD");
    const [adding, setAdding] = useState(false);
    
    const [cashBalanceMap, setCashBalanceMap] = useState<Map<string, number>>(new Map());
    const [convertedCashBalance, setConvertedCashBalance] = useState(0);
    const [convertedItems, setConvertedItems] = useState<{item: WishlistItem, convertedCost: number}[]>([]);
    
    // Convert numbers dynamically when items or cache changes
    const mainCurrency = ledger?.currency_code ?? "USD";

    const loadItems = async () => {
        if (!ledger) return;
        setLoading(true);
        try {
            const data = await getWishlistItems(ledger.id);
            setItems(data);
        } catch {
            toast("Failed to load wishlist", "error");
        } finally {
            setLoading(false);
        }
    };

    const loadCashBalance = async () => {
        if (!ledger) return;
        try {
            const { data, error } = await supabase
                .from("accounts")
                .select("balance, currency_code")
                .eq("ledger_id", ledger.id)
                .in("account_type", ["checking", "savings", "cash"])
                .eq("is_active", true);
            
            if (error) throw error;
            const balMap = new Map<string, number>();
            data?.forEach(acc => {
                const cur = balMap.get(acc.currency_code) || 0;
                balMap.set(acc.currency_code, cur + Number(acc.balance));
            });
            setCashBalanceMap(balMap);
        } catch {
            console.error("Failed to load cash balance");
        }
    };

    const convertAll = async () => {
        if (!ledger) return;
        
        // 1. Convert Cash balances to main Currency
        const cashItems = Array.from(cashBalanceMap.entries()).map(([currency, amount]) => ({ amount, currency }));
        const convCashItems = await batchConvert(cashItems, mainCurrency);
        const totalCash = convCashItems.reduce((sum, val) => sum + val, 0);
        setConvertedCashBalance(totalCash);

        // 2. Convert Wishlist items to main Currency
        const wishlistItems = items.map(item => ({ amount: Number(item.cost), currency: item.currency_code }));
        const convWishlistItems = await batchConvert(wishlistItems, mainCurrency);
        setConvertedItems(items.map((item, i) => ({ item, convertedCost: convWishlistItems[i] })));
    };

    useEffect(() => {
        if (items.length >= 0 || cashBalanceMap.size >= 0) {
            convertAll();
        }
    }, [items, cashBalanceMap, mainCurrency]);

    useEffect(() => {
        if (ledger) {
            loadItems();
            loadCashBalance();
        }
    }, [ledger]);

    const handleAddItem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ledger || !newItemName || !newItemCost || !canWrite) return;
        
        const cost = parseFloat(newItemCost);
        if (isNaN(cost) || cost <= 0) {
            toast("Please enter a valid cost", "error");
            return;
        }

        setAdding(true);
        try {
            const newItem = await createWishlistItem(ledger.id, {
                name: newItemName,
                cost,
                currency_code: newItemCurrency,
                is_selected: false
            });
            setItems([...items, newItem]);
            setNewItemName("");
            setNewItemCost("");
            toast("Item added to wishlist", "success");
        } catch {
            toast("Failed to add item", "error");
        } finally {
            setAdding(false);
        }
    };

    const handleToggleSelect = async (id: string, current: boolean) => {
        if (!canWrite) return;
        try {
            await toggleWishlistItemSelection(id, !current);
            setItems(items.map(item => item.id === id ? { ...item, is_selected: !current } : item));
        } catch {
            toast("Failed to update item", "error");
        }
    };

    const handleDelete = async (id: string) => {
        if (!canWrite) return;
        try {
            await deleteWishlistItem(id);
            setItems(items.filter(item => item.id !== id));
            toast("Item deleted", "success");
        } catch {
            toast("Failed to delete item", "error");
        }
    };

    const formatCurrency = (amount: number, currency?: string) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency || mainCurrency,
        }).format(amount);
    };

    const [convertedMonthlyIncome, setConvertedMonthlyIncome] = useState(0);
    
    useEffect(() => {
        if (!ledger) return;
        const income = ledger.monthly_income || 0;
        const currency = ledger.monthly_income_currency || mainCurrency;
        if (currency === mainCurrency) {
            setConvertedMonthlyIncome(income);
        } else {
            batchConvert([{amount: income, currency}], mainCurrency)
                .then(res => setConvertedMonthlyIncome(res[0]));
        }
    }, [ledger, mainCurrency]);
    
    // Aggregate stats for selected items (Using Converted costs)
    const selectedConvertedItems = convertedItems.filter(x => x.item.is_selected);
    const totalSelectedCost = selectedConvertedItems.reduce((sum, x) => sum + x.convertedCost, 0);
    const comfortAfterSelected = convertedCashBalance - totalSelectedCost;
    
    // Time until can buy all selected
    // if cost <= cash, time is 0. Else (cost - cash) / income.
    const timeToBuySelectedMonths = convertedMonthlyIncome > 0 
        ? Math.max(0, (totalSelectedCost - convertedCashBalance) / convertedMonthlyIncome) 
        : (totalSelectedCost <= convertedCashBalance ? 0 : Infinity);

    const formatMonths = (months: number) => {
        if (months === 0) return "Can buy now";
        if (months === Infinity) return "Never (no income)";
        if (months < 1) return "< 1 month";
        return `${months.toFixed(1)} months`;
    };

    return (
        <AppShell>
            <div className="mb-6 flex items-end justify-between">
                <div>
                    <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Wishlist</h1>
                    <p className="text-sm mt-1" style={{ color: "var(--text-tertiary)" }}>
                        Track things you want to buy and see how long it will take to afford them.
                    </p>
                </div>
            </div>

            {/* Stats Panel */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="rounded-2xl p-5 themed-card">
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Cash Comfort</p>
                    <p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{formatCurrency(convertedCashBalance)}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Checking + Savings + Cash</p>
                </div>
                
                <div className={`rounded-2xl p-5 border ${selectedConvertedItems.length > 0 ? 'border-blue-500/50 bg-blue-500/10' : 'themed-card border-transparent'}`}>
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Selected Cost</p>
                    <p className="text-2xl font-bold text-blue-400">{formatCurrency(totalSelectedCost)}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>{selectedConvertedItems.length} items selected</p>
                    <p className="text-[10px] text-zinc-500 mt-1">💱 converted to {mainCurrency}</p>
                </div>

                <div className="rounded-2xl p-5 themed-card relative overflow-hidden">
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Comfort After</p>
                    <p className={`text-2xl font-bold ${comfortAfterSelected < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatCurrency(comfortAfterSelected)}
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>If bought today</p>
                </div>

                <div className="rounded-2xl p-5 themed-card">
                    <p className="text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>Time to Buy</p>
                    <p className="text-2xl font-bold text-amber-400">{formatMonths(timeToBuySelectedMonths)}</p>
                    <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>Based on avg income {formatCurrency(convertedMonthlyIncome)}/mo</p>
                </div>
            </div>

            {/* Add Item Form */}
            {canWrite && (
                <div className="mb-8 rounded-2xl p-5 themed-card">
                    <h2 className="text-lg font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Add New Item</h2>
                    <form onSubmit={handleAddItem} className="flex gap-4 items-end">
                        <div className="flex-1">
                            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Item Name</label>
                            <input
                                type="text"
                                required
                                value={newItemName}
                                onChange={(e) => setNewItemName(e.target.value)}
                                placeholder="e.g. New Laptop"
                                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                            />
                        </div>
                        <div className="w-56 flex gap-2">
                            <div className="w-20">
                                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Cur</label>
                                <select 
                                    value={newItemCurrency}
                                    onChange={(e) => setNewItemCurrency(e.target.value)}
                                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-2 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                                >
                                    {ALL_CURRENCIES.map(c => (
                                        <option key={c.code} value={c.code}>{c.code}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex-1">
                                <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>Cost</label>
                                <input
                                    type="number"
                                    required
                                    min="0.01"
                                    step="0.01"
                                    value={newItemCost}
                                    onChange={(e) => setNewItemCost(e.target.value)}
                                    placeholder="0.00"
                                    className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={adding}>{adding ? "Adding..." : "Add to Wishlist"}</Button>
                    </form>
                </div>
            )}

            {/* Items List */}
            <div className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 overflow-hidden">
                <div className="px-6 py-4 border-b border-zinc-800/50 flex justify-between items-center">
                    <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>Your Wishlist</h2>
                </div>

                {loading ? (
                    <div className="p-6"><TableSkeleton rows={3} /></div>
                ) : items.length === 0 ? (
                    <div className="p-12"><EmptyState icon="✨" title="No items yet" description="Start adding things you want to buy." /></div>
                ) : (
                    <div className="divide-y divide-zinc-800/50 w-full overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-zinc-900/50 text-xs text-zinc-400 uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-3 font-medium w-10">Sel</th>
                                    <th className="px-6 py-3 font-medium">Item Name</th>
                                    <th className="px-6 py-3 font-medium text-right">Cost</th>
                                    <th className="px-6 py-3 font-medium text-right">Time to Buy Alone</th>
                                    <th className="px-6 py-3 font-medium w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-800/50">
                                {convertedItems.map(({item, convertedCost}) => {
                                    const cost = Number(item.cost);
                                    const isForeign = item.currency_code !== mainCurrency;
                                    const timeToBuyAlone = convertedMonthlyIncome > 0 
                                        ? Math.max(0, (convertedCost - convertedCashBalance) / convertedMonthlyIncome) 
                                        : (convertedCost <= convertedCashBalance ? 0 : Infinity);

                                    return (
                                        <tr key={item.id} className="hover:bg-zinc-800/20 transition-colors group">
                                            <td className="px-6 py-4">
                                                <input
                                                    type="checkbox"
                                                    disabled={!canWrite}
                                                    checked={item.is_selected}
                                                    onChange={() => handleToggleSelect(item.id, item.is_selected)}
                                                    className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/20 cursor-pointer h-4 w-4"
                                                />
                                            </td>
                                            <td className="px-6 py-4">
                                                <p className={`font-medium ${item.is_selected ? 'text-white' : 'text-zinc-300'}`}>{item.name}</p>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <p className="font-mono text-zinc-300">
                                                    {ALL_CURRENCIES.find(c => c.code === item.currency_code)?.flag} {formatCurrency(cost, item.currency_code)}
                                                </p>
                                                {isForeign && (
                                                    <p className="text-[10px] text-zinc-500 mt-1">
                                                        ≈ {formatCurrency(convertedCost, mainCurrency)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right text-zinc-400">
                                                {formatMonths(timeToBuyAlone)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {canWrite && (
                                                    <button
                                                        onClick={() => handleDelete(item.id)}
                                                        className="text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-2 rounded-md hover:bg-red-400/10"
                                                        title="Delete item"
                                                    >
                                                        🗑️
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </AppShell>
    );
}
