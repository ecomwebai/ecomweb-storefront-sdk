/**
 * Decides whether a just-placed checkout should send the shopper to a
 * payment gateway, or leave today's inline "order placed" success flow
 * untouched.
 *
 * Deliberately pure: no network call, no `window` access. The page
 * component (`checkout-page-client.tsx`) performs the actual redirect once
 * this function tells it to.
 */

/**
 * The pinned `@ecomweb/sdk` version's `StorePaymentMethod` type does not yet
 * declare `provider_code` (see `lib/checkout/initiate-gateway-payment.ts` for
 * the full story — the SDK PR that adds it is not merged, and this repo's
 * lockfile pins an older commit). The backend already returns the field on
 * `GET /storefront/stores/:storeRef/payment-methods` today, so this function is
 * typed against only the one field it actually needs rather than the SDK's
 * (currently stale) full type, and the call site casts to this shape.
 */
export interface PaymentMethodWithProviderCode {
  provider_code?: string | null;
}

export interface PaymentRedirectIntent {
  readonly provider_code: string;
  readonly order_code: string;
}

/**
 * A payment method with a non-null `provider_code` is gateway-backed
 * (OnePay, MoMo, ...) and the shopper must be sent to the provider to pay.
 * A method without one (`cod`, `bank_transfer`) is settled offline — the
 * existing inline success screen is correct for it and this returns `null`.
 *
 * The returned intent carries `order_code`, never an order id: the
 * `payments/initiate` endpoint is keyed on it deliberately, because the
 * storefront API key authenticates the store rather than the shopper and a
 * raw sequential id would let a caller enumerate a store's orders.
 */
export function getPaymentRedirectIntent(
  method: PaymentMethodWithProviderCode | null | undefined,
  order_code: string
): PaymentRedirectIntent | null {
  const provider_code = method?.provider_code;
  if (!provider_code) {
    return null;
  }

  return { provider_code, order_code };
}
