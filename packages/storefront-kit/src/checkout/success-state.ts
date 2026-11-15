import type { OrderHandoff } from "./order-handoff";

/**
 * Which success screen an order gets.
 *
 * `confirming` / `still-confirming` / `failed` belong to the gateway return
 * flow, where the browser beats the provider's callback back to us and the
 * page polls until the real state resolves.
 *
 * `placed` and `awaiting-transfer` are the offline methods, which now land
 * here too rather than rendering an inline view on the checkout page. They
 * are terminal on arrival: nothing is in flight, so there is nothing to poll
 * for and the screen must not imply otherwise.
 *
 * `awaiting-transfer` exists because a bank_transfer order stays `pending`
 * until the merchant confirms the money arrived. Without it such an order
 * fell into `still-confirming`, whose copy says confirmation "is taking
 * longer than usual" — actively wrong. Nothing is slow; the shopper simply
 * has not paid yet.
 */
export type PaymentConfirmationState =
  | "confirming"
  | "paid"
  | "placed"
  | "awaiting-transfer"
  | "still-confirming"
  | "failed";

/**
 * The state to render on arrival, before any polling.
 *
 * `order_code` absent means there is no order to confirm at all, which keeps
 * the historical behaviour of treating the page as an immediate success
 * screen.
 */
export function resolveInitialState(
  order_code: string | null,
  handoff: OrderHandoff | null
): PaymentConfirmationState {
  if (!order_code) return "paid";

  // A gateway-backed handoff still has a payment in flight: poll.
  if (handoff && !handoff.provider_code) {
    return handoff.payment_method === "bank_transfer"
      ? "awaiting-transfer"
      : "placed";
  }

  return "confirming";
}

/**
 * Whether this state should start the gateway confirmation poll.
 *
 * Offline orders must not: there is no callback coming, so polling would burn
 * the whole backoff budget and then downgrade a perfectly good screen to
 * "still-confirming".
 */
export function shouldPollForConfirmation(
  state: PaymentConfirmationState
): boolean {
  return state === "confirming";
}
