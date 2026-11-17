"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  SHIPPING_ERROR_CODES,
  type PaymentMethod,
  type StorePaymentMethod,
} from "@ecomweb/sdk";
import { isBrowserStorePreview } from "../api/store-preview-header";
import { useAuth } from "../auth/context";
import { useCart } from "../cart/server-context";
import { useNotify } from "../notices";
import { publicOrdersApi } from "../orders/api-client";
import { usePromotionValidation } from "../promotions/use-promotion-validation";
import { sdk } from "../sdk";
import { useShippingCalculation } from "../shipping/use-shipping-calculation";
import { useStoreData } from "../store/store-context";
import { STORE_PREVIEW_READ_ONLY_MESSAGE } from "../stores/store-preview-guard";
import { initiateGatewayPayment } from "./initiate-gateway-payment";
import { writeOrderHandoff, type OrderHandoffSummary } from "./order-handoff";
import {
  getPaymentRedirectIntent,
  type PaymentMethodWithProviderCode,
} from "./payment-redirect";
import { startGatewayRedirect } from "./start-gateway-redirect";
import { quoteChangedOptionsFrom } from "./quote-changed";
import { insufficientItemsFrom, stockIssuesByLine } from "./stock-issues";
import { getPaymentMethod } from "./utils";

/** What the shopper entered; the app owns the form and its validation. */
export interface PlaceOrderInput {
  fullName: string;
  phone: string;
  email?: string;
  street: string;
  /** Province code, as quoted for shipping. */
  province: string;
  /** Ward code, as quoted for shipping. */
  ward: string;
  notes?: string;
  /** A `payment_method` code from `paymentMethods`. */
  paymentMethod: string;
  /**
   * What the thank-you page shows of the order; stored with the handoff in
   * this browser only, never sent to the API.
   */
  summary?: OrderHandoffSummary;
}

export interface PlacedOrder {
  order_code: string;
  total: number | string | null;
}

/**
 * - redirect: the shopper is being sent to the payment provider.
 * - redirect_failed: the order exists but the provider hand-off did not
 *   start; offer retryPaymentRedirect(). Further placeOrder calls return
 *   this again instead of creating a second order.
 * - success: an offline-payment order; show its confirmation.
 * - stock_issues: nothing was placed; `issues` is copy keyed by cart line id.
 * - error: nothing was placed. `code` is the API's error code when it sent
 *   one; pass it to `errorCopy`. On ORDER_PROMOTION_NOT_APPLICABLE the applied
 *   code has already been removed, so the shopper sees the real total before
 *   placing again.
 * - quote_changed: nothing was placed; the shipping options were replaced with
 *   the API's new prices and the selection kept where possible; show
 *   `SHIPPING_MESSAGES.quoteChanged` and let the shopper place again.
 * - busy: an earlier placeOrder is still running; this call did nothing.
 */
export type PlaceOrderResult =
  | { kind: "redirect" }
  | { kind: "redirect_failed"; orderCode: string }
  | { kind: "success"; order: PlacedOrder }
  | { kind: "stock_issues"; issues: Record<string, string> }
  | { kind: "error"; message: string; code?: string }
  | { kind: "quote_changed" }
  | { kind: "busy" };

export interface UseCheckoutOptions {
  /** The address fields shipping is quoted against (codes, may be empty). */
  province: string;
  ward: string;
  /**
   * Ask the API for carrier-quoted shipping options too. Off by default;
   * passed to `useShippingCalculation`.
   */
  includeCarrierOptions?: boolean;
  /** Leaves for the payment provider; defaults to a full-page navigation. */
  navigateToGateway?: (url: string) => void;
}

const defaultNavigateToGateway = (url: string) => {
  window.location.href = url;
};

/**
 * Checkout without the UI: payment methods, shipping quotes, promotions,
 * totals, placing the order and the payment-provider hand-off. The app
 * renders the form and decides what to show for each PlaceOrderResult.
 *
 * Must run under {@link StorefrontKitProvider}, which supplies the store, auth
 * and cart it reads.
 *
 * @param options - The address codes shipping is quoted for, and optional
 * carrier quotes and gateway navigation ({@link UseCheckoutOptions}).
 * @returns The cart `items`, `paymentMethods`, `shipping`, `promotion` and
 * `totals` state, `stockIssues`, and `placeOrder` with the payment redirect
 * helpers.
 *
 * @example
 * ```tsx
 * "use client";
 * import { useCheckout } from "@ecomweb/storefront-kit";
 *
 * export function PlaceOrderButton({ province, ward, form }) {
 *   const checkout = useCheckout({ province, ward });
 *   return (
 *     <button
 *       disabled={checkout.isSubmitting}
 *       onClick={() => checkout.placeOrder(form)}
 *     >
 *       Pay {checkout.totals.total}
 *     </button>
 *   );
 * }
 * ```
 */
export function useCheckout({
  province,
  ward,
  includeCarrierOptions = false,
  navigateToGateway = defaultNavigateToGateway,
}: UseCheckoutOptions) {
  const store = useStoreData();
  const notify = useNotify();
  const {
    items,
    total,
    subtotal,
    originalSubtotal,
    discountAmount,
    clearCart,
    cartId,
    isLoading: isCartLoading,
  } = useCart();
  const { user, isAnonymous } = useAuth();

  const [paymentMethods, setPaymentMethods] = useState<StorePaymentMethod[]>(
    []
  );
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(true);
  const [savedAddressId, setSavedAddressId] = useState<number | undefined>(
    undefined
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Set only when the order was placed but the gateway redirect failed to
  // start. The order already exists, so the cart is deliberately left
  // intact until a redirect actually commits — this is what lets the shopper
  // retry payment without resubmitting the order.
  const [redirectError, setRedirectError] = useState<{
    order_code: string;
    provider_code: string;
  } | null>(null);
  const [isRetryingRedirect, setIsRetryingRedirect] = useState(false);
  // Set synchronously, unlike isSubmitting: a double-click lands before the
  // re-render that would disable the button.
  const inFlight = useRef(false);
  // Copy keyed by cart line id when the API rejects the order for short
  // stock. Cleared on the next submit.
  const [stockIssues, setStockIssues] = useState<Record<string, string>>({});

  const totalWeight = items.reduce(
    (sum, item) =>
      sum + ((item as { weight_gr?: number }).weight_gr || 500) * item.quantity,
    0
  );

  const shippingQuote = useShippingCalculation({
    storeRef: store.ref,
    city: province,
    ward,
    subtotal,
    totalWeight,
    itemsCount: items.length,
    includeCarrierOptions,
  });

  const promotionState = usePromotionValidation({
    storeRef: store.ref,
    items: items.map(item => ({
      productId: item.productId,
      variantId: item.variantId ?? null,
      quantity: item.quantity,
      price: item.price,
    })),
    subtotal,
    shippingFee: shippingQuote.shippingFee,
  });

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoadingPaymentMethods(true);
        setPaymentMethods(await sdk.paymentMethods.getEnabled(store.ref));
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Failed to load payment methods:", error);
        notify({
          kind: "error",
          code: "checkout.payment_methods_failed",
          title: "Không thể tải phương thức thanh toán",
          description: "Vui lòng thử lại sau",
        });
      } finally {
        setIsLoadingPaymentMethods(false);
      }
    };
    load();
  }, [store.ref, notify]);

  const redirectTo = useCallback(
    (target: { order_code: string; provider_code: string }) =>
      startGatewayRedirect({
        initiate: () => initiateGatewayPayment(store.ref, target),
        clearCart: () => clearCart(false),
        navigate: navigateToGateway,
      }),
    [store.ref, clearCart, navigateToGateway]
  );

  const placeOrder = async (
    input: PlaceOrderInput
  ): Promise<PlaceOrderResult> => {
    // The order from a failed hand-off still exists and the cart is kept for
    // it; placing again would create a second order for the same cart.
    if (redirectError) {
      return { kind: "redirect_failed", orderCode: redirectError.order_code };
    }
    if (inFlight.current) {
      return { kind: "busy" };
    }
    // A preview is read-only: the API would refuse the order anyway.
    if (isBrowserStorePreview()) {
      return {
        kind: "error",
        message: STORE_PREVIEW_READ_ONLY_MESSAGE,
        code: "STORE_COMING_SOON",
      };
    }
    inFlight.current = true;
    setIsSubmitting(true);
    setStockIssues({});
    // The quote this attempt is made against. A reply that lands after the
    // shopper changed the address must not overwrite the newer options.
    const quoteRequestId = shippingQuote.currentRequestId();

    try {
      const shippingOption = shippingQuote.selectedOption;
      const orderData = {
        cart_id: cartId || undefined,
        customer_name: input.fullName,
        customer_phone: input.phone,
        customer_email: input.email || "",
        // Money fields are deliberately not sent: the API recomputes subtotal,
        // shipping, discounts and total from the catalog and its own rules,
        // and ignores anything supplied here.
        shipping_street: input.street,
        shipping_city: input.province,
        shipping_ward: input.ward,
        payment_method: getPaymentMethod(input.paymentMethod) as PaymentMethod,
        // The shopper's choice of rate is real input; the API prices it and
        // rejects a rate_id that isn't one it just quoted for this address
        // and cart. useShippingCalculation clears the selection the moment an
        // input it was quoted against changes, so this is either nothing
        // (omitted, the API picks) or an option from the matching quote.
        // A carrier option also names its service and the amount the shopper
        // saw; after a quote_changed that is the replaced amount, so the
        // retry confirms the new price.
        ...(shippingOption && {
          shipping_rate_id: shippingOption.rate_id,
          ...(shippingOption.carrier_service_id && {
            shipping_service_id: shippingOption.carrier_service_id,
            shipping_quoted_amount: shippingOption.amount,
          }),
        }),
        notes: input.notes || undefined,
        promotion_id: promotionState.appliedPromotion?.id || undefined,
        // The API applies a discount-code promotion only when the code itself
        // comes with its id; older APIs ignore the field.
        promotion_code: promotionState.appliedPromotion?.code || undefined,
        ...(savedAddressId && { customer_address_id: savedAddressId }),
        items: items.map(item => ({
          product_id: item.productId,
          variant_id: item.variantId,
          variant_name: item.variantName,
          product_name: item.name,
          product_image: item.image,
          quantity: item.quantity,
          // No price/total: the API resolves the unit price from the catalog.
        })),
      };

      // A signed-in (non-anonymous) shopper's order goes to the authenticated
      // route so the backend links it to their customer record; guests and
      // anonymous identities keep the public route.
      const order = await publicOrdersApi.createStoreOrder(
        store.ref,
        orderData,
        !!user && !isAnonymous
      );

      // The order now exists no matter what happens below. A gateway-backed
      // method (non-null provider_code) must send the shopper to the provider
      // to pay; offline methods land on the success screen.
      const method = paymentMethods.find(
        m => m.payment_method === input.paymentMethod
      ) as PaymentMethodWithProviderCode | undefined;
      const intent = getPaymentRedirectIntent(method, order.order_code);

      if (intent) {
        try {
          await redirectTo(intent);
          return { kind: "redirect" };
        } catch (initiateError) {
          // eslint-disable-next-line no-console
          console.error("Failed to initiate gateway payment:", initiateError);
          setRedirectError(intent);
          return { kind: "redirect_failed", orderCode: intent.order_code };
        }
      }

      // The handoff carries what the success screen cannot ask the API for:
      // the amount to transfer (see order-handoff.ts).
      writeOrderHandoff({
        order_code: order.order_code,
        payment_method: input.paymentMethod,
        provider_code: method?.provider_code ?? null,
        total: Number(order.total ?? 0),
        currency_code:
          (order as { currency_code?: string }).currency_code ?? "VND",
        summary: input.summary ?? null,
      });
      clearCart(false);
      return {
        kind: "success",
        order: { order_code: order.order_code, total: order.total ?? null },
      };
    } catch (error) {
      const shortItems = insufficientItemsFrom(error);
      if (shortItems) {
        const issues = stockIssuesByLine(items, shortItems);
        setStockIssues(issues);
        return { kind: "stock_issues", issues };
      }
      // The carrier's price moved since the shopper saw it. Show the new
      // options (selection kept where possible) and let them place again.
      const changed = quoteChangedOptionsFrom(error);
      if (changed) {
        shippingQuote.replaceOptions(
          changed,
          shippingQuote.selectedOptionId,
          quoteRequestId
        );
        return { kind: "quote_changed" };
      }
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code?: unknown }).code
          : undefined;
      // The API refused the order rather than drop the discount the shopper
      // was shown (or the code is used up). Keeping the code would fail every
      // retry the same way. PROMOTION_IDENTITY_REQUIRED keeps the code: the
      // shopper only has to add an email and place again.
      if (
        code === "ORDER_PROMOTION_NOT_APPLICABLE" ||
        code === "PROMOTION_USAGE_LIMIT_REACHED"
      ) {
        promotionState.removePromoCode();
      }
      // The carrier could not price the chosen option, or reported a changed
      // quote we cannot use: refresh the options so the shopper can pick
      // again instead of being stuck on a stale list.
      if (
        code === SHIPPING_ERROR_CODES.RATE_UNAVAILABLE ||
        code === SHIPPING_ERROR_CODES.QUOTE_CHANGED
      ) {
        shippingQuote.retryCalculation();
      }
      return {
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
        ...(typeof code === "string" && { code }),
      };
    } finally {
      inFlight.current = false;
      setIsSubmitting(false);
    }
  };

  // The order already exists — this only re-attempts starting the gateway
  // charge, never re-submits the order.
  const retryPaymentRedirect =
    useCallback(async (): Promise<PlaceOrderResult> => {
      if (!redirectError) return { kind: "error", message: "No order to pay" };
      setIsRetryingRedirect(true);
      try {
        await redirectTo(redirectError);
        return { kind: "redirect" };
      } catch (retryError) {
        // eslint-disable-next-line no-console
        console.error("Failed to retry gateway payment redirect:", retryError);
        return { kind: "redirect_failed", orderCode: redirectError.order_code };
      } finally {
        setIsRetryingRedirect(false);
      }
    }, [redirectError, redirectTo]);

  return {
    items,
    isCartLoading,
    paymentMethods,
    isLoadingPaymentMethods,
    shipping: {
      fee: shippingQuote.shippingFee,
      options: shippingQuote.shippingOptions,
      selectedRate: shippingQuote.selectedShippingRate,
      isCalculating: shippingQuote.isCalculatingShipping,
      hasCalculated: shippingQuote.hasCalculatedShipping,
      calculationFailed: shippingQuote.calculationFailed,
      /** @deprecated Use selectOption. */
      selectRate: shippingQuote.handleShippingRateSelect,
      selectedOptionId: shippingQuote.selectedOptionId,
      selectedOption: shippingQuote.selectedOption,
      selectOption: shippingQuote.handleShippingOptionSelect,
      retry: shippingQuote.retryCalculation,
    },
    promotion: {
      code: promotionState.promoCode,
      setCode: promotionState.setPromoCode,
      applied: promotionState.appliedPromotion,
      shippingDiscount: promotionState.shippingDiscount,
      isValidating: promotionState.isValidatingPromo,
      error: promotionState.promoError,
      validate: promotionState.validatePromoCode,
      remove: promotionState.removePromoCode,
      applySuggestion: promotionState.applyPromotionFromSuggestion,
    },
    // shippingDiscount comes from the API's promotion validation — the same
    // number the server applies when the order is placed.
    totals: {
      subtotal,
      originalSubtotal,
      discount: discountAmount,
      cartTotal: total,
      shipping: shippingQuote.shippingFee,
      shippingDiscount: promotionState.shippingDiscount,
      total:
        total + shippingQuote.shippingFee - promotionState.shippingDiscount,
    },
    savedAddressId,
    selectSavedAddress: setSavedAddressId,
    stockIssues,
    isSubmitting,
    redirectError,
    isRetryingRedirect,
    placeOrder,
    retryPaymentRedirect,
  };
}
