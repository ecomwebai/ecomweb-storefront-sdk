/**
 * Polling policy for confirming a gateway (OnePay/MoMo) payment after the
 * shopper's browser returns from the provider.
 *
 * The browser almost always beats the gateway's server-to-server callback
 * back to us — so the return URL carries no authority of its own; it only
 * decides which page to show. The order's real state comes from the API,
 * which the callback updates asynchronously. This module is the policy that
 * keeps asking the API until that state resolves, or gives up gracefully.
 *
 * A late callback is NORMAL, not exceptional — it is exactly the case the
 * expiry design elsewhere in this system accommodates by expiring an
 * abandoned attempt to reversible `ON_HOLD` rather than terminal
 * `CANCELLED`. So exhausting the attempt budget here must resolve to a
 * "pending" outcome, never "failed": a shopper who actually paid and is
 * merely waiting on a slow callback must never be told their payment
 * failed.
 *
 * Deliberately pure and timer-free: no `setTimeout`/`setInterval`, no
 * `window`, no React state. The delay mechanism (`wait`) is injected by the
 * caller, so tests can run this to completion synchronously (or nearly so)
 * with a `wait` that resolves immediately and simply records the delay it
 * was asked for — no fake timers required. `computeBackoffDelay` is also
 * exported standalone so the backoff schedule itself can be asserted on
 * without invoking the poll loop at all.
 */

/** The shape mirrored from the intended `sdk.payments.getPaymentState`
 * response — see `lib/checkout/get-payment-state.ts` for the temporary
 * adapter that fetches it. */
export interface PaymentStateResult {
  payment_status: string;
  order_status: string;
}

export type PollOutcome =
  | { status: "paid"; result: PaymentStateResult }
  | { status: "failed"; result: PaymentStateResult }
  /** Attempts ran out (or every attempt errored) without a terminal status.
   * `result` is the last successful poll's payload, if any attempt
   * succeeded at all. */
  | { status: "pending"; result: PaymentStateResult | null };

const TERMINAL_STATUSES = new Set(["paid", "failed"]);

export interface PollPaymentStateOptions {
  /** Performs one status check against the API. May reject — a single
   * rejection must not abort the sequence. */
  poll: () => Promise<PaymentStateResult>;
  /** Delay mechanism, injected by the caller (e.g. a `setTimeout`-based
   * wait in the page component). Deliberately has no default here so this
   * module never touches a timer API directly. */
  wait: (ms: number) => Promise<void>;
  /** Total number of poll attempts before giving up. Default 6. */
  maxAttempts?: number;
  /** Delay before the 2nd attempt, ms. Default 2000. */
  baseDelayMs?: number;
  /** Multiplier applied to the delay on each subsequent gap. Default 1.5. */
  backoffFactor?: number;
  /** Ceiling on any single delay, ms. Default 15000. */
  maxDelayMs?: number;
}

/**
 * The exponential backoff schedule, exposed standalone so it can be
 * asserted on directly without running the poll loop.
 *
 * @param attemptIndex 0-based index of the gap being computed — the delay
 *   awaited after poll attempt `attemptIndex + 1` and before attempt
 *   `attemptIndex + 2`.
 */
export function computeBackoffDelay(
  attemptIndex: number,
  baseDelayMs: number,
  backoffFactor: number,
  maxDelayMs: number
): number {
  const delay = baseDelayMs * Math.pow(backoffFactor, attemptIndex);
  return Math.min(delay, maxDelayMs);
}

/**
 * Repeatedly polls payment state until it resolves to a terminal status
 * (`paid`, `failed`), or the attempt budget is exhausted — in which case
 * the outcome is `"pending"`, never `"failed"`. A single poll error is
 * swallowed and counted as a used (non-terminal) attempt so a transient
 * network blip cannot abort the sequence.
 */
export async function pollPaymentState(
  options: PollPaymentStateOptions
): Promise<PollOutcome> {
  const {
    poll,
    wait,
    maxAttempts = 6,
    baseDelayMs = 2000,
    backoffFactor = 1.5,
    maxDelayMs = 15000,
  } = options;

  let lastResult: PaymentStateResult | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const result = await poll();
      lastResult = result;
      if (TERMINAL_STATUSES.has(result.payment_status)) {
        return {
          status: result.payment_status as "paid" | "failed",
          result,
        };
      }
    } catch {
      // A failed request is not a failed payment. Swallow it and keep
      // polling — the next attempt (or the ones after it) may still land.
    }

    const isLastAttempt = attempt === maxAttempts - 1;
    if (!isLastAttempt) {
      const delay = computeBackoffDelay(
        attempt,
        baseDelayMs,
        backoffFactor,
        maxDelayMs
      );
      await wait(delay);
    }
  }

  return { status: "pending", result: lastResult };
}
