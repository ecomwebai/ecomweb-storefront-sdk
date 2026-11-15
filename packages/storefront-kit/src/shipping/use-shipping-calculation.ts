import { sdk } from "../sdk";
import { useReducer, useEffect, useCallback, useRef, useMemo } from "react";
import type { ShippingOption } from "@ecomweb/sdk";
import { SHIPPING_MESSAGES } from "./messages";
import { useNotify } from "../notices";
import { optionIdOf } from "./option-id";
import { isBrowserStorePreview } from "../api/store-preview-header";
import { STORE_PREVIEW_READ_ONLY_NOTICE } from "../stores/store-preview-guard";
import { isStoreComingSoonError } from "../stores/store-coming-soon";
import {
  shippingCalculationReducer,
  initialShippingCalculationState,
} from "./shipping-calculation-reducer";

interface UseShippingCalculationProps {
  storeRef: string;
  city: string;
  ward: string;
  subtotal: number;
  totalWeight: number;
  itemsCount: number;
  /**
   * Ask the API for carrier-quoted options too. Off by default so stores
   * that have not updated send exactly the body they always did.
   */
  includeCarrierOptions?: boolean;
}

export function useShippingCalculation({
  storeRef,
  city,
  ward,
  subtotal,
  totalWeight,
  itemsCount,
  includeCarrierOptions = false,
}: UseShippingCalculationProps) {
  const [state, dispatch] = useReducer(
    shippingCalculationReducer,
    initialShippingCalculationState
  );
  const notify = useNotify();

  // The callback below is memoised, so it must not close over a stale
  // `state`. This ref always holds the latest.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Clear stale shipping state the instant an input that affects pricing
  // changes -- BEFORE the debounce below even starts a timer, let alone
  // before the network round-trip it eventually kicks off. Gating on
  // isCalculatingShipping (see checkout-page-client's isSubmitDisabled)
  // only closes the network window; it's still false for the full 500ms
  // debounce, so without this a shopper editing their address and
  // submitting inside that window would send the PREVIOUS quote's
  // rate_id against the NEW address -- exactly what the API's rate_id
  // match now rejects. Clearing here means the worst case during that
  // window is no rate_id at all (the API falls back to picking the best
  // option), never a stale, mismatched one.
  useEffect(() => {
    dispatch({ type: "RESET" });
  }, [city, ward, subtotal, totalWeight, includeCarrierOptions]);

  const calculateShippingFee = useCallback(async () => {
    if (!city || !ward || itemsCount === 0) {
      dispatch({ type: "RESET" });
      return;
    }

    // A store preview is read-only and the API refuses this POST with
    // STORE_COMING_SOON, which would show as a shipping error. Say it is a
    // preview instead, like the cart and checkout writes do.
    if (isBrowserStorePreview()) {
      dispatch({ type: "RESET" });
      notify(STORE_PREVIEW_READ_ONLY_NOTICE);
      return;
    }

    // The id this request will be judged against. CALCULATION_STARTED
    // bumps the counter, so the request in flight owns `next`; anything
    // that resets or starts after this makes the response stale.
    const next = stateRef.current.requestId + 1;
    dispatch({ type: "CALCULATION_STARTED" });

    try {
      const options = await sdk.shipping.calculate(storeRef, {
        province_id: city,
        ward_id: ward,
        subtotal: subtotal,
        currency: "VND",
        weight_gr: totalWeight,
        ...(includeCarrierOptions && { include_carrier_options: true }),
      });

      dispatch({ type: "CALCULATION_SUCCEEDED", options, requestId: next });
    } catch (error) {
      // eslint-disable-next-line no-console
      // The reducer already discards a stale failure, but the notice is
      // outside it: an older request failing after a newer one succeeded
      // would show an error over perfectly good options. Only the request
      // that still owns the quote may report anything.
      if (next !== stateRef.current.requestId) return;

      if (isStoreComingSoonError(error)) {
        dispatch({ type: "RESET" });
        notify(STORE_PREVIEW_READ_ONLY_NOTICE);
        return;
      }

      console.error("Failed to calculate shipping fee:", error);
      dispatch({ type: "CALCULATION_FAILED", requestId: next });
      notify({
        kind: "error",
        code: "shipping.quote_failed",
        title: SHIPPING_MESSAGES.failed,
        description: SHIPPING_MESSAGES.failedHint,
      });
    }
  }, [
    city,
    ward,
    itemsCount,
    storeRef,
    subtotal,
    totalWeight,
    includeCarrierOptions,
    notify,
  ]);

  // Debounced effect to prevent too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      calculateShippingFee();
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
  }, [calculateShippingFee]);

  // Handle shipping rate selection
  const handleShippingRateSelect = useCallback((rateId: number) => {
    dispatch({ type: "RATE_SELECTED", rateId });
  }, []);

  const handleShippingOptionSelect = useCallback((optionId: string) => {
    dispatch({ type: "OPTION_SELECTED", optionId });
  }, []);

  const replaceOptions = useCallback(
    (
      options: ShippingOption[],
      preferOptionId: string | null,
      requestId: number
    ) => {
      dispatch({ type: "QUOTE_REPLACED", options, requestId, preferOptionId });
    },
    []
  );

  const currentRequestId = useCallback(() => stateRef.current.requestId, []);

  const selectedOption = useMemo(
    () =>
      state.selectedOptionId === null
        ? null
        : (state.shippingOptions.find(
            o => optionIdOf(o) === state.selectedOptionId
          ) ?? null),
    [state.shippingOptions, state.selectedOptionId]
  );

  return {
    shippingFee: state.shippingFee,
    isCalculatingShipping: state.isCalculatingShipping,
    hasCalculatedShipping: state.hasCalculatedShipping,
    shippingOptions: state.shippingOptions,
    selectedShippingRate: state.selectedShippingRate,
    calculationFailed: state.calculationFailed,
    selectedOptionId: state.selectedOptionId,
    selectedOption,
    handleShippingOptionSelect,
    replaceOptions,
    currentRequestId,
    handleShippingRateSelect,
    /**
     * Re-run the quote with the inputs unchanged. The debounced effect only
     * fires when an input dependency changes, so after a transient failure
     * there was otherwise no way back: the shopper had to edit the address
     * or reload the page.
     */
    retryCalculation: calculateShippingFee,
  };
}
