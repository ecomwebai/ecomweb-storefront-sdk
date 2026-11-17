import { createStoreSdk } from "../sdk";
import type { PaymentStateResult } from "./payment-state-poll";

/**
 * Reads where a payment stands for an order, from the browser, through the
 * store's backend proxy (`createStoreSdk`), which adds the secret key. Browser
 * only: the proxied SDK uses a relative URL. On a server use `getServerSdk()`.
 *
 * @param storeRef - the store's ref
 * @param order_code - the order's code
 * @returns the payment state of the order
 */
export async function getPaymentState(
  storeRef: string,
  order_code: string
): Promise<PaymentStateResult> {
  return createStoreSdk(storeRef).payments.getPaymentState(
    storeRef,
    order_code
  );
}
