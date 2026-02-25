import { supabase } from "@/lib/supabase/client";

// ─── Currency List ───────────────────────────────────────────────────
export interface CurrencyInfo {
    code: string;
    name: string;
    flag: string;
    symbol: string;
}

export const CURRENCIES: CurrencyInfo[] = [
    { code: "USD", name: "US Dollar", flag: "🇺🇸", symbol: "$" },
    { code: "EUR", name: "Euro", flag: "🇪🇺", symbol: "€" },
    { code: "GBP", name: "British Pound", flag: "🇬🇧", symbol: "£" },
    { code: "JPY", name: "Japanese Yen", flag: "🇯🇵", symbol: "¥" },
    { code: "CAD", name: "Canadian Dollar", flag: "🇨🇦", symbol: "CA$" },
    { code: "AUD", name: "Australian Dollar", flag: "🇦🇺", symbol: "A$" },
    { code: "CHF", name: "Swiss Franc", flag: "🇨🇭", symbol: "Fr" },
    { code: "CNY", name: "Chinese Yuan", flag: "🇨🇳", symbol: "¥" },
    { code: "INR", name: "Indian Rupee", flag: "🇮🇳", symbol: "₹" },
    { code: "ZAR", name: "South African Rand", flag: "🇿🇦", symbol: "R" },
    { code: "BRL", name: "Brazilian Real", flag: "🇧🇷", symbol: "R$" },
    { code: "MXN", name: "Mexican Peso", flag: "🇲🇽", symbol: "Mex$" },
    { code: "KRW", name: "South Korean Won", flag: "🇰🇷", symbol: "₩" },
    { code: "SEK", name: "Swedish Krona", flag: "🇸🇪", symbol: "kr" },
    { code: "NOK", name: "Norwegian Krone", flag: "🇳🇴", symbol: "kr" },
    { code: "DKK", name: "Danish Krone", flag: "🇩🇰", symbol: "kr" },
    { code: "PLN", name: "Polish Złoty", flag: "🇵🇱", symbol: "zł" },
    { code: "SGD", name: "Singapore Dollar", flag: "🇸🇬", symbol: "S$" },
    { code: "HKD", name: "Hong Kong Dollar", flag: "🇭🇰", symbol: "HK$" },
    { code: "NZD", name: "New Zealand Dollar", flag: "🇳🇿", symbol: "NZ$" },
    { code: "TRY", name: "Turkish Lira", flag: "🇹🇷", symbol: "₺" },
    { code: "THB", name: "Thai Baht", flag: "🇹🇭", symbol: "฿" },
    { code: "TWD", name: "Taiwan Dollar", flag: "🇹🇼", symbol: "NT$" },
    { code: "ILS", name: "Israeli Shekel", flag: "🇮🇱", symbol: "₪" },
    { code: "AED", name: "UAE Dirham", flag: "🇦🇪", symbol: "د.إ" },
    { code: "SAR", name: "Saudi Riyal", flag: "🇸🇦", symbol: "﷼" },
    { code: "PHP", name: "Philippine Peso", flag: "🇵🇭", symbol: "₱" },
    { code: "MYR", name: "Malaysian Ringgit", flag: "🇲🇾", symbol: "RM" },
    { code: "IDR", name: "Indonesian Rupiah", flag: "🇮🇩", symbol: "Rp" },
    { code: "CZK", name: "Czech Koruna", flag: "🇨🇿", symbol: "Kč" },
    { code: "HUF", name: "Hungarian Forint", flag: "🇭🇺", symbol: "Ft" },
    { code: "CLP", name: "Chilean Peso", flag: "🇨🇱", symbol: "CLP$" },
    { code: "COP", name: "Colombian Peso", flag: "🇨🇴", symbol: "COL$" },
    { code: "ARS", name: "Argentine Peso", flag: "🇦🇷", symbol: "ARS$" },
    { code: "EGP", name: "Egyptian Pound", flag: "🇪🇬", symbol: "E£" },
    { code: "NGN", name: "Nigerian Naira", flag: "🇳🇬", symbol: "₦" },
    { code: "KES", name: "Kenyan Shilling", flag: "🇰🇪", symbol: "KSh" },
];

export function getCurrencyInfo(code: string): CurrencyInfo {
    return CURRENCIES.find((c) => c.code === code) ?? { code, name: code, flag: "💱", symbol: code };
}

// ─── Exchange Rate Fetching ──────────────────────────────────────────

// In-memory cache: { "USD-EUR": { rate: 0.92, fetchedAt: timestamp } }
const rateCache = new Map<string, { rate: number; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

/**
 * Fetch the exchange rate between two currencies using a free public API.
 * Caches in memory for 1 hour and persists to the exchange_rates table.
 */
export async function getRate(from: string, to: string): Promise<number> {
    if (from === to) return 1;

    const cacheKey = `${from}-${to}`;
    const cached = rateCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
        return cached.rate;
    }

    // Check Supabase table (may have recent rate)
    const today = new Date().toISOString().slice(0, 10);
    const { data: dbRate } = await supabase
        .from("exchange_rates")
        .select("rate")
        .eq("base_currency", from)
        .eq("quote_currency", to)
        .eq("rate_date", today)
        .single();

    if (dbRate?.rate) {
        rateCache.set(cacheKey, { rate: dbRate.rate, fetchedAt: Date.now() });
        return dbRate.rate;
    }

    // Fetch from free public API
    try {
        const res = await fetch(
            `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${from.toLowerCase()}.json`
        );
        if (!res.ok) throw new Error(`Rate API returned ${res.status}`);
        const data = await res.json();
        const rates = data[from.toLowerCase()];
        const rate = rates?.[to.toLowerCase()];

        if (!rate || typeof rate !== "number") {
            throw new Error(`No rate found for ${from}->${to}`);
        }

        // Cache in memory
        rateCache.set(cacheKey, { rate, fetchedAt: Date.now() });

        // Persist to DB (fire-and-forget)
        supabase.from("exchange_rates").upsert({
            base_currency: from,
            quote_currency: to,
            rate,
            rate_date: today,
            source: "fawazahmed0/currency-api",
        }, { onConflict: "base_currency,quote_currency,rate_date" }).then(() => { });

        return rate;
    } catch (err) {
        console.warn(`[Ledgerly] Failed to fetch rate ${from}->${to}:`, err);
        // Fallback: check if we have any historical rate
        const { data: fallback } = await supabase
            .from("exchange_rates")
            .select("rate")
            .eq("base_currency", from)
            .eq("quote_currency", to)
            .order("rate_date", { ascending: false })
            .limit(1)
            .single();

        if (fallback?.rate) {
            rateCache.set(cacheKey, { rate: fallback.rate, fetchedAt: Date.now() });
            return fallback.rate;
        }

        return 1; // Last resort: no conversion
    }
}

/**
 * Convert an amount from one currency to another.
 */
export async function convert(amount: number, from: string, to: string): Promise<number> {
    if (from === to) return amount;
    const rate = await getRate(from, to);
    return amount * rate;
}

/**
 * Batch-convert multiple amounts to a target currency.
 * Pre-fetches all unique rates to minimize API calls.
 */
export async function batchConvert(
    items: { amount: number; currency: string }[],
    targetCurrency: string
): Promise<number[]> {
    const uniqueCurrencies = [...new Set(items.map((i) => i.currency).filter((c) => c !== targetCurrency))];

    // Pre-fetch all rates
    const rates = new Map<string, number>();
    rates.set(targetCurrency, 1);
    await Promise.all(
        uniqueCurrencies.map(async (from) => {
            const rate = await getRate(from, targetCurrency);
            rates.set(from, rate);
        })
    );

    return items.map((item) => item.amount * (rates.get(item.currency) ?? 1));
}
