import currencyJs from "currency.js";

export type SupportedCurrency = "VND" | "USD" | "EUR" | "SGD";

/**
 * Picks the locale used to format prices in a currency: `en-US` for USD, EUR
 * and SGD, `vi-VN` for VND.
 *
 * @param currency - The store's currency code.
 * @returns A BCP 47 locale tag.
 */
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

/**
 * Formats a plain number with the locale's digit grouping, without a currency
 * symbol.
 *
 * @param amount - The number to format.
 * @param locale - BCP 47 locale tag; defaults to `vi-VN`.
 * @returns The formatted number.
 */
export function formatNumber(amount: number, locale = "vi-VN"): string {
  // General number formatting (non-currency)
  return new Intl.NumberFormat(locale).format(amount);
}

/**
 * Formats a price range such as a product's lowest and highest variant price.
 *
 * @param min - The lowest price.
 * @param max - The highest price.
 * @param locale - BCP 47 locale tag; defaults to `vi-VN`.
 * @param code - Currency code; defaults to `VND`.
 * @returns One formatted price when the two match or `max` is missing, `min - max` otherwise, and an empty string when both are missing.
 */
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

/**
 * Wraps a value in a currency.js object for safe money arithmetic (add,
 * subtract, multiply, format) without floating-point drift.
 *
 * @param value - The amount, as a number or numeric string.
 * @param locale - BCP 47 locale tag; defaults to `vi-VN`.
 * @param code - Currency code; defaults to `VND`.
 * @returns A currency.js value configured for that locale and currency.
 */
export const money = (
  value: number | string,
  locale: string = "vi-VN",
  code: SupportedCurrency = "VND"
) => currencyJs(value as any, getCurrencyOptions(locale, code));

// Format for inputs (no symbol), keeps separators consistent with currency options
/**
 * Formats an amount with the currency's separators but no symbol, for price
 * inputs.
 *
 * @param amount - The amount to format.
 * @param locale - BCP 47 locale tag; defaults to `vi-VN`.
 * @param code - Currency code; defaults to `VND`.
 * @returns The formatted amount.
 */
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
