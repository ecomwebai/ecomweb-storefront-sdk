import currencyJs from "currency.js";

export type SupportedCurrency = "VND" | "USD" | "EUR" | "SGD";

export function getDefaultLocale(currency: SupportedCurrency): string {
  switch (currency) {
    case "USD":
    case "EUR":
    case "SGD":
      return "en-US";
    case "VND":
      return "vi-VN";
    default:
      return "vi-VN";
  }
}

/**
 * House formatting convention, one table for every currency we price in.
 *
 * A locale bundles four decisions — group separator, decimal separator,
 * symbol, and symbol placement — behind one string, and we want them from
 * different places. `vi-VN` renders 10.234.000 ₫ with a space and the dong
 * sign; the house style is 10.234.000đ, tight and with the Latin d-stroke.
 * So the table is explicit.
 *
 * Numerals are uniform across currencies: dot groups, comma decimals. Only
 * the symbol, its placement, and the precision vary.
 *
 *   VND  10.234.000đ     USD  $1.234,50
 *   EUR  €1.234,50       SGD  S$1.234,50
 *
 * Keep this in sync with the same table in ecomweb-dashboard/lib/currency.ts
 * and the API's src/common/utils/currency.utils.ts. The pinned tests in each
 * repo exist to catch drift between the three.
 */
const CURRENCY_FORMATS = {
  VND: { symbol: "đ", precision: 0, suffix: true },
  USD: { symbol: "$", precision: 2, suffix: false },
  EUR: { symbol: "€", precision: 2, suffix: false },
  SGD: { symbol: "S$", precision: 2, suffix: false },
} as const;

/** Narrows an arbitrary stored code to a currency we can price in. */
export function isSupportedCurrency(
  code: unknown
): code is SupportedCurrency {
  return (
    typeof code === "string" &&
    Object.prototype.hasOwnProperty.call(CURRENCY_FORMATS, code)
  );
}

function getCurrencyOptions(_locale: string, code: SupportedCurrency | string) {
  const format =
    CURRENCY_FORMATS[code as SupportedCurrency] ?? CURRENCY_FORMATS.VND;

  return {
    symbol: format.symbol,
    precision: format.precision,
    // Uniform numerals: 1.234.567,89 regardless of currency.
    separator: ".",
    decimal: ",",
    // The sign stays outermost: -10.234.000đ and -$19,99.
    pattern: format.suffix ? "#!" : "!#",
    negativePattern: format.suffix ? "-#!" : "-!#",
  } as const;
}

/**
 * Format an amount as money in the given currency.
 *
 * `locale` is retained for call-site compatibility but no longer affects the
 * output — the house convention in CURRENCY_FORMATS is uniform across
 * locales. It still matters to formatNumber, which is not currency.
 */
export function formatPrice(
  amount: number,
  locale: string = "vi-VN",
  code: SupportedCurrency | string = "VND"
): string {
  const opts = getCurrencyOptions(locale, code);
  return currencyJs(amount, opts).format();
}

export function formatNumber(amount: number, locale = "vi-VN"): string {
  // General number formatting (non-currency)
  return new Intl.NumberFormat(locale).format(amount);
}

export function formatPriceRange(
  min?: number,
  max?: number,
  locale: string = "vi-VN",
  code: SupportedCurrency = "VND"
): string {
  if (min == null && max == null) return "";
  if (max == null || min === max) return formatPrice(min || 0, locale, code);
  return `${formatPrice(min || 0, locale, code)} - ${formatPrice(max, locale, code)}`;
}

// Helper to perform safe currency calculations using currency.js
export const money = (
  value: number | string,
  locale: string = "vi-VN",
  code: SupportedCurrency = "VND"
) => currencyJs(value as any, getCurrencyOptions(locale, code));

// Format for inputs (no symbol), keeps separators consistent with currency options
export function formatPriceWithoutSymbol(
  amount: number,
  locale: string = "vi-VN",
  code: SupportedCurrency = "VND"
): string {
  const base = getCurrencyOptions(locale, code);
  const opts = {
    ...base,
    symbol: "",
    pattern: "#",
    negativePattern: "-#",
  } as const;
  return currencyJs(amount, opts).format();
}
