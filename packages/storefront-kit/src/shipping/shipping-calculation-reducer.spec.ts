import { describe, it, expect } from "vitest";
import type { ShippingOption } from "@ecomweb/sdk";
import {
  shippingCalculationReducer,
  initialShippingCalculationState,
  type ShippingCalculationState,
} from "./shipping-calculation-reducer";

function option(overrides: Partial<ShippingOption>): ShippingOption {
  return {
    amount: 25000,
    currency: "VND",
    rate_id: 1,
    delivery_type: "STANDARD",
    display_name: "Standard",
    ...overrides,
  };
}

/** A state as if a previous quote had already landed and been selected. */
function stateWithPreviousQuote(): ShippingCalculationState {
  return {
    shippingFee: 25000,
    isCalculatingShipping: false,
    hasCalculatedShipping: true,
    shippingOptions: [option({ rate_id: 42, amount: 25000 })],
    selectedShippingRate: 42,
    selectedOptionId: "42",
    requestId: 3,
    calculationFailed: false,
  };
}

describe("shippingCalculationReducer", () => {
  describe("RESET", () => {
    it("clears every field back to the initial state", () => {
      const result = shippingCalculationReducer(stateWithPreviousQuote(), {
        type: "RESET",
      });
      // requestId is the exception and must keep climbing: a response
      // issued before this reset has to stay recognisable as stale.
      expect(result).toEqual({
        ...initialShippingCalculationState,
        requestId: 4,
      });
    });

    it("is what closes the debounce window: a rate id from a previous quote never survives an input change", () => {
      const previous = stateWithPreviousQuote();
      const afterInputChanged = shippingCalculationReducer(previous, {
        type: "RESET",
      });
      // The exact bug this guards against: submitting rate_id 42 (priced
      // for the OLD address) against a NEW address/cart, which the API
      // now rejects because it never priced that rate for this request.
      expect(afterInputChanged.selectedShippingRate).toBeNull();
      expect(afterInputChanged.shippingOptions).toEqual([]);
      expect(afterInputChanged.hasCalculatedShipping).toBe(false);
    });
  });

  describe("CALCULATION_STARTED", () => {
    it("sets isCalculatingShipping without touching other fields", () => {
      const before = { ...initialShippingCalculationState };
      const result = shippingCalculationReducer(before, {
        type: "CALCULATION_STARTED",
      });
      expect(result.isCalculatingShipping).toBe(true);
      expect(result.shippingOptions).toEqual(before.shippingOptions);
      expect(result.selectedShippingRate).toBe(before.selectedShippingRate);
    });
  });

  describe("CALCULATION_SUCCEEDED", () => {
    it("auto-selects the cheapest option, not the first", () => {
      const options = [
        option({ rate_id: 7, amount: 50000 }),
        option({ rate_id: 8, amount: 0 }),
        option({ rate_id: 9, amount: 30000 }),
      ];
      const result = shippingCalculationReducer(
        initialShippingCalculationState,
        { type: "CALCULATION_SUCCEEDED", options, requestId: 0 }
      );
      expect(result.selectedShippingRate).toBe(8);
      expect(result.shippingFee).toBe(0);
    });

    it("keeps the API's order on a price tie", () => {
      const options = [
        option({ rate_id: 7, amount: 30000 }),
        option({ rate_id: 8, amount: 30000 }),
      ];
      const result = shippingCalculationReducer(
        initialShippingCalculationState,
        { type: "CALCULATION_SUCCEEDED", options, requestId: 0 }
      );
      expect(result.selectedShippingRate).toBe(7);
    });

    it("auto-selects the first option's rate_id and amount", () => {
      const options = [
        option({ rate_id: 7, amount: 15000 }),
        option({ rate_id: 8, amount: 30000 }),
      ];
      const result = shippingCalculationReducer(
        initialShippingCalculationState,
        { type: "CALCULATION_SUCCEEDED", options, requestId: 0 }
      );
      expect(result.selectedShippingRate).toBe(7);
      expect(result.shippingFee).toBe(15000);
      expect(result.hasCalculatedShipping).toBe(true);
      expect(result.isCalculatingShipping).toBe(false);
      expect(result.shippingOptions).toBe(options);
    });

    it("replaces a stale selection from a previous quote, never merges it", () => {
      // The settled-state guarantee the reviewer confirmed: once a NEW
      // quote lands, the OLD rate_id (42) cannot survive even if it
      // happens to still be a valid id for something else.
      const staleState = stateWithPreviousQuote();
      const freshOptions = [option({ rate_id: 99, amount: 18000 })];
      const result = shippingCalculationReducer(staleState, {
        type: "CALCULATION_SUCCEEDED",
        options: freshOptions,
        requestId: staleState.requestId,
      });
      expect(result.selectedShippingRate).toBe(99);
      expect(result.selectedShippingRate).not.toBe(42);
    });

    it("clears the selection when the address has no available options", () => {
      const result = shippingCalculationReducer(stateWithPreviousQuote(), {
        type: "CALCULATION_SUCCEEDED",
        options: [],
        requestId: 3,
      });
      expect(result.selectedShippingRate).toBeNull();
      expect(result.shippingFee).toBe(0);
      expect(result.hasCalculatedShipping).toBe(true);
      expect(result.shippingOptions).toEqual([]);
    });
  });

  describe("CALCULATION_FAILED", () => {
    it("resets fee, options and selection, and stops the calculating flag", () => {
      const result = shippingCalculationReducer(stateWithPreviousQuote(), {
        type: "CALCULATION_FAILED",
        requestId: 3,
      });
      expect(result.shippingFee).toBe(0);
      expect(result.shippingOptions).toEqual([]);
      expect(result.selectedShippingRate).toBeNull();
      expect(result.hasCalculatedShipping).toBe(false);
      expect(result.isCalculatingShipping).toBe(false);
    });
  });

  describe("RATE_SELECTED", () => {
    const options = [
      option({ rate_id: 1, amount: 10000 }),
      option({ rate_id: 2, amount: 20000 }),
    ];
    const base: ShippingCalculationState = {
      ...initialShippingCalculationState,
      hasCalculatedShipping: true,
      shippingOptions: options,
      selectedShippingRate: 1,
      shippingFee: 10000,
    };

    it("updates the selection and fee to the matching option", () => {
      const result = shippingCalculationReducer(base, {
        type: "RATE_SELECTED",
        rateId: 2,
      });
      expect(result.selectedShippingRate).toBe(2);
      expect(result.shippingFee).toBe(20000);
    });

    it("still records the id but keeps the prior fee for an id not in the current options", () => {
      const result = shippingCalculationReducer(base, {
        type: "RATE_SELECTED",
        rateId: 999,
      });
      expect(result.selectedShippingRate).toBe(999);
      expect(result.shippingFee).toBe(base.shippingFee);
    });
  });

  describe("out-of-order responses", () => {
    it("discards a success carrying an older request id", () => {
      // The slow quote for the PREVIOUS address landing after a newer one
      // started. Without the id it restored its own options, its rate id,
      // and an enabled submit button.
      const current = { ...stateWithPreviousQuote(), requestId: 5 };
      const result = shippingCalculationReducer(current, {
        type: "CALCULATION_SUCCEEDED",
        options: [option({ rate_id: 1, amount: 99000 })],
        requestId: 4,
      });
      expect(result).toBe(current);
    });

    it("discards a failure carrying an older request id", () => {
      const current = { ...stateWithPreviousQuote(), requestId: 5 };
      const result = shippingCalculationReducer(current, {
        type: "CALCULATION_FAILED",
        requestId: 4,
      });
      expect(result).toBe(current);
    });

    it("keeps counting across a reset so a pre-reset response stays stale", () => {
      const reset = shippingCalculationReducer(stateWithPreviousQuote(), {
        type: "RESET",
      });
      expect(reset.requestId).toBe(4);
      const late = shippingCalculationReducer(reset, {
        type: "CALCULATION_SUCCEEDED",
        options: [option({ rate_id: 42, amount: 25000 })],
        requestId: 3,
      });
      expect(late.selectedShippingRate).toBeNull();
    });
  });

  describe("failure is distinguishable from not-yet-quoted", () => {
    it("flags a failure so the UI can offer a retry", () => {
      const result = shippingCalculationReducer(stateWithPreviousQuote(), {
        type: "CALCULATION_FAILED",
        requestId: 3,
      });
      expect(result.calculationFailed).toBe(true);
      expect(result.hasCalculatedShipping).toBe(false);
    });

    it("clears the flag when a retry starts", () => {
      const failed = shippingCalculationReducer(stateWithPreviousQuote(), {
        type: "CALCULATION_FAILED",
        requestId: 3,
      });
      const retrying = shippingCalculationReducer(failed, {
        type: "CALCULATION_STARTED",
      });
      expect(retrying.calculationFailed).toBe(false);
    });

    it("clears the flag when a retry succeeds", () => {
      const failed = { ...stateWithPreviousQuote(), calculationFailed: true };
      const ok = shippingCalculationReducer(failed, {
        type: "CALCULATION_SUCCEEDED",
        options: [option({ rate_id: 5, amount: 20000 })],
        requestId: failed.requestId,
      });
      expect(ok.calculationFailed).toBe(false);
    });
  });
  describe("option_id selection", () => {
    const succeed = (
      options: ShippingOption[],
      state = initialShippingCalculationState
    ) => {
      const started = shippingCalculationReducer(state, {
        type: "CALCULATION_STARTED",
      });
      return shippingCalculationReducer(started, {
        type: "CALCULATION_SUCCEEDED",
        options,
        requestId: started.requestId,
      });
    };

    it("two carrier options under one rate are selected independently", () => {
      const state = succeed([
        option({ rate_id: 41, option_id: "41:a", amount: 30000 }),
        option({ rate_id: 41, option_id: "41:b", amount: 22000 }),
      ]);
      expect(state.selectedOptionId).toBe("41:b");
      expect(state.shippingFee).toBe(22000);
      const picked = shippingCalculationReducer(state, {
        type: "OPTION_SELECTED",
        optionId: "41:a",
      });
      expect(picked.selectedOptionId).toBe("41:a");
      expect(picked.shippingFee).toBe(30000);
      expect(picked.selectedShippingRate).toBe(41);
    });

    it("older options without option_id select by rate_id", () => {
      const state = succeed([
        option({ rate_id: 7, amount: 0 }),
        option({ rate_id: 9, amount: 15000 }),
      ]);
      expect(state.selectedOptionId).toBe("7");
      const byOption = shippingCalculationReducer(state, {
        type: "OPTION_SELECTED",
        optionId: "9",
      });
      expect(byOption.shippingFee).toBe(15000);
      const byRate = shippingCalculationReducer(state, {
        type: "RATE_SELECTED",
        rateId: 9,
      });
      expect(byRate.shippingFee).toBe(15000);
      expect(byRate.selectedOptionId).toBe("9");
      expect(byRate.selectedShippingRate).toBe(9);
    });
  });

  describe("QUOTE_REPLACED", () => {
    const base = (): ShippingCalculationState => ({
      ...stateWithPreviousQuote(),
      shippingOptions: [
        option({ rate_id: 41, option_id: "41:a", amount: 30000 }),
        option({ rate_id: 41, option_id: "41:b", amount: 22000 }),
      ],
      selectedOptionId: "41:a",
      selectedShippingRate: 41,
      shippingFee: 30000,
      requestId: 5,
    });

    it("keeps the buyer's option at its new price", () => {
      const result = shippingCalculationReducer(base(), {
        type: "QUOTE_REPLACED",
        requestId: 5,
        preferOptionId: "41:a",
        options: [
          option({ option_id: "41:a", rate_id: 41, amount: 33000 }),
          option({ option_id: "41:b", rate_id: 41, amount: 22000 }),
        ],
      });
      expect(result.selectedOptionId).toBe("41:a");
      expect(result.shippingFee).toBe(33000);
      expect(result.hasCalculatedShipping).toBe(true);
      expect(result.requestId).toBe(5);
    });

    it("falls back to the cheapest when the option is gone", () => {
      const result = shippingCalculationReducer(base(), {
        type: "QUOTE_REPLACED",
        requestId: 5,
        preferOptionId: "41:gone",
        options: [
          option({ option_id: "41:b", rate_id: 41, amount: 22000 }),
          option({ option_id: "42:c", rate_id: 42, amount: 40000 }),
        ],
      });
      expect(result.selectedOptionId).toBe("41:b");
      expect(result.shippingFee).toBe(22000);
    });

    it("from before an address change is ignored", () => {
      const reset = shippingCalculationReducer(base(), { type: "RESET" });
      const result = shippingCalculationReducer(reset, {
        type: "QUOTE_REPLACED",
        requestId: 5,
        preferOptionId: "41:a",
        options: [option({ option_id: "41:a", rate_id: 41, amount: 33000 })],
      });
      expect(result).toBe(reset);
    });

    it("keeps the options the API did not return", () => {
      const result = shippingCalculationReducer(base(), {
        type: "QUOTE_REPLACED",
        requestId: 5,
        preferOptionId: "41:a",
        options: [option({ option_id: "41:a", rate_id: 41, amount: 33000 })],
      });
      expect(result.shippingOptions.map(o => o.option_id)).toEqual([
        "41:a",
        "41:b",
      ]);
      expect(result.shippingOptions[0].amount).toBe(33000);
      expect(result.shippingOptions[1].amount).toBe(22000);
      expect(result.selectedOptionId).toBe("41:a");
      expect(result.shippingFee).toBe(33000);
    });

    it("appends options that were not in the list", () => {
      const result = shippingCalculationReducer(base(), {
        type: "QUOTE_REPLACED",
        requestId: 5,
        preferOptionId: "41:a",
        options: [option({ option_id: "42:c", rate_id: 42, amount: 40000 })],
      });
      expect(result.shippingOptions.map(o => o.option_id)).toEqual([
        "41:a",
        "41:b",
        "42:c",
      ]);
    });
  });
});
