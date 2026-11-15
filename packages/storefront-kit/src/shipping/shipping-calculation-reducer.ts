import type { ShippingOption } from "@ecomweb/sdk";
import { optionIdOf } from "./option-id";

/**
 * State backing `useShippingCalculation`. Kept as one object (not five
 * separate `useState`s) so the transitions below are a single pure
 * function -- reachable from a plain vitest spec instead of only being
 * exercisable by rendering the hook.
 */
export interface ShippingCalculationState {
  shippingFee: number;
  isCalculatingShipping: boolean;
  hasCalculatedShipping: boolean;
  shippingOptions: ShippingOption[];
  /** The `rate_id` of the selected option; kept for existing callers. */
  selectedShippingRate: number | null;
  /**
   * The selected option's identity (`optionIdOf`). Several carrier options
   * can share one `rate_id`, so this, not the rate id, picks the option.
   */
  selectedOptionId: string | null;
  /**
   * Identifies the quote currently considered current. Bumped by RESET and
   * by CALCULATION_STARTED; a response carrying an older id is discarded.
   * Without this, a slow request issued for the PREVIOUS address could land
   * after a newer one and restore its options, its rate id, and an
   * enabled submit button.
   */
  requestId: number;
  /**
   * The last quote attempt failed. Distinct from "not quoted yet": submit
   * is blocked in both cases, but only this one should offer a retry.
   * Without it a transient failure left checkout disabled with no way
   * forward short of editing the address or reloading the page.
   */
  calculationFailed: boolean;
}

export const initialShippingCalculationState: ShippingCalculationState = {
  shippingFee: 0,
  isCalculatingShipping: false,
  hasCalculatedShipping: false,
  shippingOptions: [],
  selectedShippingRate: null,
  selectedOptionId: null,
  requestId: 0,
  calculationFailed: false,
};

export type ShippingCalculationAction =
  /**
   * The address or cart changed. Dispatched synchronously, before the
   * caller's debounce timer even starts -- this is what guarantees a rate
   * id from the PREVIOUS quote can never survive to be submitted against
   * the NEW address: between an input change and the next quote landing,
   * there is no selected rate at all, only ever a stale one or a fresh
   * one. Also covers the "address/cart incomplete" early-out.
   */
  | { type: "RESET" }
  | { type: "CALCULATION_STARTED" }
  | {
      type: "CALCULATION_SUCCEEDED";
      options: ShippingOption[];
      requestId: number;
    }
  | { type: "CALCULATION_FAILED"; requestId: number }
  /**
   * The current quote was re-priced (e.g. the API reported a changed
   * quote). Judged against the current `requestId` like
   * CALCULATION_SUCCEEDED, and does not bump it. MERGES by option id: the
   * given options replace matching entries, other existing options are
   * kept (the API re-checks their amounts at placement), and new ones are
   * appended. Keeps `preferOptionId` selected when it is still offered, else
   * the cheapest option.
   */
  | {
      type: "QUOTE_REPLACED";
      options: ShippingOption[];
      requestId: number;
      preferOptionId: string | null;
    }
  /** The shopper picked a specific option out of the current quote. */
  | { type: "OPTION_SELECTED"; optionId: string }
  /** @deprecated Use OPTION_SELECTED. Selects the first option with this rate_id. */
  | { type: "RATE_SELECTED"; rateId: number };

interface Selection {
  optionId: string | null;
  rateId: number | null;
  fee: number;
}

/**
 * Picks `preferId` when it is among `options`, else the cheapest option
 * (the API's order breaks ties), as shoppers expect: a free rate is never
 * passed over for a paid one.
 */
function selectFrom(
  options: ShippingOption[],
  preferId: string | null
): Selection {
  const preferred =
    preferId === null
      ? undefined
      : options.find(option => optionIdOf(option) === preferId);
  const chosen =
    preferred ??
    options.reduce<ShippingOption | null>(
      (best, option) => (!best || option.amount < best.amount ? option : best),
      null
    );
  return chosen
    ? {
        optionId: optionIdOf(chosen),
        rateId: chosen.rate_id,
        fee: chosen.amount,
      }
    : { optionId: null, rateId: null, fee: 0 };
}

export function shippingCalculationReducer(
  state: ShippingCalculationState,
  action: ShippingCalculationAction
): ShippingCalculationState {
  switch (action.type) {
    case "RESET":
      // Keep counting up: a response from before the reset must still be
      // recognisable as stale.
      return {
        ...initialShippingCalculationState,
        requestId: state.requestId + 1,
      };

    case "CALCULATION_STARTED":
      return {
        ...state,
        isCalculatingShipping: true,
        calculationFailed: false,
        requestId: state.requestId + 1,
      };

    case "CALCULATION_SUCCEEDED": {
      if (action.requestId !== state.requestId) return state;
      const { options } = action;
      const picked = selectFrom(options, null);
      return {
        ...state,
        shippingOptions: options,
        hasCalculatedShipping: true,
        isCalculatingShipping: false,
        // Auto-select the cheapest option. This also revalidates the
        // selection on every successful recalculation: it is always
        // replaced with an option guaranteed to belong to THIS response,
        // so a stale selection from an earlier quote can never linger.
        selectedOptionId: picked.optionId,
        selectedShippingRate: picked.rateId,
        shippingFee: picked.fee,
        calculationFailed: false,
      };
    }

    case "QUOTE_REPLACED": {
      if (action.requestId !== state.requestId) return state;
      const incoming = new Map(action.options.map(o => [optionIdOf(o), o]));
      const merged = state.shippingOptions.map(
        o => incoming.get(optionIdOf(o)) ?? o
      );
      const known = new Set(state.shippingOptions.map(optionIdOf));
      for (const o of action.options) {
        if (!known.has(optionIdOf(o))) {
          known.add(optionIdOf(o));
          merged.push(o);
        }
      }
      const picked = selectFrom(merged, action.preferOptionId);
      return {
        ...state,
        shippingOptions: merged,
        hasCalculatedShipping: true,
        isCalculatingShipping: false,
        selectedOptionId: picked.optionId,
        selectedShippingRate: picked.rateId,
        shippingFee: picked.fee,
        calculationFailed: false,
      };
    }

    case "CALCULATION_FAILED":
      if (action.requestId !== state.requestId) return state;
      return {
        ...state,
        shippingFee: 0,
        shippingOptions: [],
        selectedShippingRate: null,
        selectedOptionId: null,
        hasCalculatedShipping: false,
        isCalculatingShipping: false,
        calculationFailed: true,
      };

    case "OPTION_SELECTED": {
      const option = state.shippingOptions.find(
        opt => optionIdOf(opt) === action.optionId
      );
      // An id that isn't in the current quote is ignored: the UI only
      // dispatches ids it just rendered from shippingOptions.
      if (!option) return state;
      return {
        ...state,
        selectedOptionId: optionIdOf(option),
        selectedShippingRate: option.rate_id,
        shippingFee: option.amount,
      };
    }

    case "RATE_SELECTED": {
      const option = state.shippingOptions.find(
        opt => opt.rate_id === action.rateId
      );
      return {
        ...state,
        selectedShippingRate: action.rateId,
        selectedOptionId: option ? optionIdOf(option) : state.selectedOptionId,
        // Preserves the previous fee if the id doesn't match a known option.
        shippingFee: option ? option.amount : state.shippingFee,
      };
    }

    default:
      return state;
  }
}
