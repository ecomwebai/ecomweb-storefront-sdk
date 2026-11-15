import { SHIPPING_ERROR_CODES, type ShippingOption } from "@ecomweb/sdk";

/**
 * The options the API now offers, read off a 409 SHIPPING_QUOTE_CHANGED.
 * Null for any other error, or when `details.options` is missing, empty or
 * has an entry without a numeric `rate_id` and `amount`; the caller then
 * treats it as a plain error. Duck-typed like `insufficientItemsFrom`.
 */
export function quoteChangedOptionsFrom(
  error: unknown
): ShippingOption[] | null {
  if (!error || typeof error !== "object") return null;
  const { code, details } = error as { code?: unknown; details?: unknown };
  if (code !== SHIPPING_ERROR_CODES.QUOTE_CHANGED) return null;

  const raw = (details as { options?: unknown } | null | undefined)?.options;
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const valid = raw.every(
    o =>
      !!o &&
      typeof o === "object" &&
      typeof (o as ShippingOption).rate_id === "number" &&
      typeof (o as ShippingOption).amount === "number"
  );
  return valid ? (raw as ShippingOption[]) : null;
}
