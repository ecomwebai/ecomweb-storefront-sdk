/**
 * Sends a shopper whose order is already placed to the payment gateway, and
 * empties their cart on the way out.
 *
 * The cart used to be left full on this path, on the reasoning that a
 * redirect which fails to start must not cost the shopper their cart. That
 * part stands: nothing is cleared until `initiate` has returned a URL. But
 * nothing cleared it afterwards either, so a shopper who paid came back to
 * the same items, and the next checkout ordered them again (in the dev data:
 * NH-990019 paid, then NH-990020 for the same variant; NH-990023 paid, then
 * NH-990024 carrying its product again).
 *
 * The clear is awaited before navigating because the navigation is a full
 * page unload, which can cancel a request still in flight. A failed clear is
 * swallowed: a stale cart is an annoyance, a shopper stranded before paying
 * for an order that already exists is a lost sale.
 *
 * The three effects are injected so the order they happen in can be tested
 * without a page; see start-gateway-redirect.spec.ts.
 */
export async function startGatewayRedirect({
  initiate,
  clearCart,
  navigate,
}: {
  initiate: () => Promise<{ redirect_url: string }>;
  clearCart: () => Promise<void>;
  navigate: (url: string) => void;
}): Promise<void> {
  const { redirect_url } = await initiate();
  try {
    await clearCart();
  } catch {
    // See above: never block the payment on the cart.
  }
  navigate(redirect_url);
}
