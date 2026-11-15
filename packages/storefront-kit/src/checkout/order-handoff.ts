/**
 * Carries what the success screen needs from the checkout page that placed
 * the order.
 *
 * Why this exists: gateway methods reach `/order-success` through the
 * provider and the API's return endpoint, so that page knows only the order
 * code. Offline methods (cod, bank_transfer) now navigate there directly, and
 * the screen has to know which method was used and how much to ask for.
 *
 * Why not read it from the API: the obvious candidate,
 * `GET /public/stores/:ref/orders/:code/payment-state`, deliberately
 * allow-lists its response down to two status fields, because it sits behind
 * only the public storefront key and order codes are sequential. Putting an
 * amount there would let anyone enumerate a store's order values. This data
 * never leaves the shopper's own browser instead.
 *
 * Replaces the older "recent-order" key, which nothing had written for a long
 * time while the success page still read it, so `orderInfo` there was always
 * null.
 */
const HANDOFF_KEY = "ecw:order-handoff";

/** Older handoffs are ignored rather than shown against a newer order. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * What the thank-you page shows of the order (contact, address, methods,
 * lines, money), built by the storefront when it places the order. Like the
 * rest of the handoff it stays in the shopper's own browser.
 */
export interface OrderHandoffSummary {
  customer_name: string;
  phone: string;
  email: string | null;
  /** The delivery address as one display line. */
  address: string;
  shipping_method: string | null;
  shipping_fee: number | null;
  payment_label: string;
  items: {
    name: string;
    variant: string | null;
    quantity: number;
    /** Unit price. */
    price: number;
    image: string | null;
  }[];
  subtotal: number;
  discount: number;
}

export interface OrderHandoff {
  order_code: string;
  /** `cod`, `bank_transfer`, or a gateway code. */
  payment_method: string;
  /** Non-null only for gateway-backed methods. */
  provider_code: string | null;
  total: number;
  currency_code: string;
  /** Absent for gateway returns and older handoffs. */
  summary?: OrderHandoffSummary | null;
  written_at: number;
}

function isSummary(value: unknown): value is OrderHandoffSummary {
  if (!value || typeof value !== "object") return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.customer_name === "string" &&
    typeof s.address === "string" &&
    typeof s.payment_label === "string" &&
    typeof s.subtotal === "number" &&
    Array.isArray(s.items) &&
    s.items.every(
      item =>
        !!item &&
        typeof item === "object" &&
        typeof (item as Record<string, unknown>).name === "string" &&
        typeof (item as Record<string, unknown>).quantity === "number" &&
        typeof (item as Record<string, unknown>).price === "number"
    )
  );
}

export function writeOrderHandoff(
  handoff: Omit<OrderHandoff, "written_at">
): void {
  try {
    window.localStorage.setItem(
      HANDOFF_KEY,
      JSON.stringify({ ...handoff, written_at: Date.now() })
    );
  } catch {
    // Private mode, quota, or storage disabled. The success screen falls back
    // to its order-code-only rendering, so losing this is a degradation and
    // never a failure.
  }
}

/**
 * Returns the handoff only if it is present, well-formed, fresh, and for the
 * order being shown. Any mismatch yields null: showing one order's amount on
 * another order's screen would be worse than showing no amount at all.
 */
export function readOrderHandoff(
  order_code: string | null
): OrderHandoff | null {
  if (!order_code) return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HANDOFF_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return matchHandoff(parsed, order_code, Date.now());
}

/**
 * The validation half of readOrderHandoff, split out so it can be tested
 * without a DOM or a clock. Exported for that reason only.
 */
export function matchHandoff(
  parsed: unknown,
  order_code: string,
  now: number
): OrderHandoff | null {
  if (!parsed || typeof parsed !== "object") return null;
  const h = parsed as Record<string, unknown>;

  if (typeof h.order_code !== "string" || h.order_code !== order_code)
    return null;
  if (typeof h.payment_method !== "string" || h.payment_method.length === 0) {
    return null;
  }
  if (typeof h.total !== "number" || !Number.isFinite(h.total)) return null;
  if (typeof h.written_at !== "number" || now - h.written_at > MAX_AGE_MS) {
    return null;
  }

  return {
    order_code: h.order_code,
    payment_method: h.payment_method,
    provider_code:
      typeof h.provider_code === "string" && h.provider_code.length > 0
        ? h.provider_code
        : null,
    total: h.total,
    currency_code:
      typeof h.currency_code === "string" && h.currency_code.length > 0
        ? h.currency_code
        : "VND",
    summary: isSummary(h.summary) ? h.summary : null,
    written_at: h.written_at,
  };
}

export function clearOrderHandoff(): void {
  try {
    window.localStorage.removeItem(HANDOFF_KEY);
  } catch {
    // Nothing to do; a stale entry expires on its own.
  }
}
