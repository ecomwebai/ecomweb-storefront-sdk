/**
 * The payment method the shopper selected already came from the store's own
 * enabled list (`sdk.paymentMethods.getEnabled()`), so it is valid by
 * construction -- the store is the sole authority on its payment method
 * vocabulary. Do NOT reinterpret or coerce it here: the API validates the
 * submitted code against that same enabled list and throws
 * PAYMENT_METHOD_NOT_ENABLED if it doesn't match, so silently substituting a
 * different value (e.g. falling back to "cod") would turn a valid checkout
 * into either a silently wrong payment method or a checkout-time 400.
 */
export function getPaymentMethod(method: string): string {
  return method.trim();
}
