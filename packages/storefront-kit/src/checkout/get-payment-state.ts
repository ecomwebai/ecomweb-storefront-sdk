import { publicApiClient } from "../api/client";
import { unwrap } from "../api/response";
import type { PaymentStateResult } from "./payment-state-poll";

/**
 * TEMPORARY adapter standing in for `sdk.payments.getPaymentState`.
 *
 * `sdk.payments` was added by this plan's Task 2
 * (`ecomweb-contracts` branch `feat/payment-client-methods`, commit `58c2c76`),
 * but that SDK PR is not yet merged to `main`, and this repo's lockfile
 * pins an older `@ecomweb/sdk` commit that has no `payments` module at all
 * — see `lib/checkout/initiate-gateway-payment.ts` for the full story
 * (same pinned commit, same missing module). Running
 * `pnpm update @ecomweb/sdk` here is explicitly out of scope for this task
 * — it is a deliberate later step in the plan.
 *
 * This function mirrors `PaymentsApi.getPaymentState()`'s request/response
 * shape exactly (same path, same result shape) so that once the SDK bump
 * lands, the fix is: delete this file, delete this import in
 * `payment-state-poll`'s caller, and call
 * `sdk.payments.getPaymentState(...)` instead — the call site already reads
 * as if it were doing that today.
 *
 * FOLLOW-UP: delete this file once `@ecomweb/sdk` is bumped past
 * `feat/payment-client-methods` and exposes `sdk.payments.getPaymentState`.
 */
export async function getPaymentState(
  storeRef: string,
  order_code: string
): Promise<PaymentStateResult> {
  const res = await publicApiClient.get<PaymentStateResult>(
    // `order_code` carries a `#` prefix by default in this system — left
    // unencoded, it truncates the URL (everything from `#` on is treated
    // as a fragment) and the request silently hits a different route.
    `/public/stores/${encodeURIComponent(storeRef)}/orders/${encodeURIComponent(order_code)}/payment-state`
  );
  return unwrap(res);
}
