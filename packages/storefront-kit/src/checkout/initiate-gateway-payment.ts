import { publicApiClient } from "../api/client";
import { unwrap } from "../api/response";

/**
 * TEMPORARY adapter standing in for `sdk.payments.initiate`.
 *
 * `sdk.payments` was added by this plan's Task 2
 * (`ecomweb-contracts` branch `feat/payment-client-methods`, commit `58c2c76`),
 * but that SDK PR is not yet merged to `main`, and this repo's lockfile
 * pins an older `@ecomweb/sdk` commit that has no `payments` module at all
 * (confirmed: nothing under `node_modules/@ecomweb/sdk/src` references
 * `payments`, `provider_code`, or `redirect_url`). Running
 * `pnpm update @ecomweb/sdk` here is explicitly out of scope for this task
 * — it is a deliberate later step in the plan.
 *
 * This function mirrors `PaymentsApi.initiate()`'s request/response shape
 * exactly (same path, same body keys, same result shape) so that once the
 * SDK bump lands, the fix is: delete this file, delete this import in
 * `checkout-page-client.tsx`, and call `sdk.payments.initiate(...)` instead
 * — the call site already reads as if it were doing that today.
 *
 * FOLLOW-UP: delete this file once `@ecomweb/sdk` is bumped past
 * `feat/payment-client-methods` and exposes `sdk.payments.initiate`.
 */
export interface InitiatePaymentResult {
  payment_id: number;
  redirect_url: string;
}

export async function initiateGatewayPayment(
  storeRef: string,
  input: { order_code: string; provider_code: string }
): Promise<InitiatePaymentResult> {
  const res = await publicApiClient.post<InitiatePaymentResult>(
    `/public/stores/${encodeURIComponent(storeRef)}/payments/initiate`,
    { order_code: input.order_code, provider_code: input.provider_code }
  );
  return unwrap(res);
}
