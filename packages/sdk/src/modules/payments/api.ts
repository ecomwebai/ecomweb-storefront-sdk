import type { IHttpClient } from "../../core/types";
import { unwrap } from "../../core/response";
import type { InitiatePaymentResult, PaymentStateResult } from "./types";

/**
 * Storefront-facing payment operations — starting a gateway charge and
 * polling its outcome. Deliberately separate from `PaymentMethodsApi`
 * (method listing) and from anything credential-related: the admin
 * credential surface is typed here (see ./types) but has no client method,
 * since the dashboard talks to it directly and this SDK must never carry a
 * plaintext credential shape.
 *
 * Both endpoints need a storefront secret key, so both go through the one
 * private HTTP client (the server SDK's, or the proxy's), never the public one.
 */
export class PaymentsApi {
  constructor(private privateHttp: IHttpClient) {}

  /**
   * Start a gateway charge attempt for an order. Keyed by `order_code`,
   * never `order_id` — the API route was deliberately re-keyed away from a
   * sequential id, since StorefrontApiKeyGuard authenticates the store
   * rather than the shopper and a raw id would let anyone enumerate a
   * store's orders.
   */
  async initiate(
    storeRef: string,
    input: { order_code: string; provider_code: string },
  ): Promise<InitiatePaymentResult> {
    const res = await this.privateHttp.post<InitiatePaymentResult>(
      `/storefront/stores/${encodeURIComponent(storeRef)}/payments/initiate`,
      { order_code: input.order_code, provider_code: input.provider_code },
    );
    return unwrap(res);
  }

  /**
   * Poll payment/order status for an order while waiting on a gateway
   * redirect or callback. `order_code` is URL-encoded: order codes contain
   * `#` by default in this system, and an unencoded `#` truncates the URL.
   */
  async getPaymentState(
    storeRef: string,
    order_code: string,
  ): Promise<PaymentStateResult> {
    const res = await this.privateHttp.get<PaymentStateResult>(
      `/storefront/stores/${encodeURIComponent(storeRef)}/orders/${encodeURIComponent(order_code)}/payment-state`,
    );
    return unwrap(res);
  }
}
