/**
 * Format a number as currency using the Intl.NumberFormat API.
 * Falls back to a simple $ prefix if the currency code is invalid.
 */
export function formatCurrency(amount: number, currencyCode = "USD"): string {
    try {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    } catch {
        return `${currencyCode} ${amount.toFixed(2)}`;
    }
}

/**
 * Returns a bound formatter for the given currency code.
 * Use this in components: `const fmt = useCurrencyFormat("EUR");`
 */
export function currencyFormatter(currencyCode = "USD") {
    return (amount: number) => formatCurrency(amount, currencyCode);
}
