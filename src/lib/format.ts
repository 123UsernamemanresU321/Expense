/**
 * Format a number as currency using the Intl.NumberFormat API.
 * Falls back to a simple prefix if the currency code is invalid.
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
 */
export function currencyFormatter(currencyCode = "USD") {
    return (amount: number) => formatCurrency(amount, currencyCode);
}

/**
 * Format an amount showing both original and converted currencies.
 * e.g. "€500.00 (≈ $545.00)"
 */
export function formatWithConversion(
    originalAmount: number,
    originalCurrency: string,
    convertedAmount: number,
    displayCurrency: string
): string {
    if (originalCurrency === displayCurrency) {
        return formatCurrency(originalAmount, displayCurrency);
    }
    return `${formatCurrency(originalAmount, originalCurrency)} (≈ ${formatCurrency(convertedAmount, displayCurrency)})`;
}
