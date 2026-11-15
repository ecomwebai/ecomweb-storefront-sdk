// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { NoticeProvider } from "../notices";
import { SHIPPING_MESSAGES } from "./messages";
import { ApiClientError } from "@ecomweb/sdk";
import { STORE_PREVIEW_READ_ONLY_NOTICE } from "../stores/store-preview-guard";
import { useShippingCalculation } from "./use-shipping-calculation";

const calculate = vi.hoisted(() => vi.fn());
vi.mock("../sdk", () => ({ sdk: { shipping: { calculate } } }));
const isPreview = vi.hoisted(() => vi.fn(() => false));
vi.mock("../api/store-preview-header", () => ({
  isBrowserStorePreview: isPreview,
}));

describe("useShippingCalculation notices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports a failed quote as an error notice", async () => {
    // A network failure arrives after React has rendered the started request
    // (the hook ignores failures of requests it no longer owns).
    calculate.mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("down")), 20)
        )
    );
    const onNotice = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NoticeProvider onNotice={onNotice}>{children}</NoticeProvider>
    );
    renderHook(
      () =>
        useShippingCalculation({
          storeRef: "s1",
          city: "79",
          ward: "26734",
          subtotal: 100,
          totalWeight: 500,
          itemsCount: 1,
        }),
      { wrapper }
    );

    await waitFor(
      () =>
        expect(onNotice).toHaveBeenCalledWith({
          kind: "error",
          code: "shipping.quote_failed",
          title: SHIPPING_MESSAGES.failed,
          description: SHIPPING_MESSAGES.failedHint,
        }),
      { timeout: 3000 }
    );
  });
});

describe("useShippingCalculation carrier options", () => {
  const base = {
    storeRef: "s1",
    city: "79",
    ward: "26734",
    subtotal: 100,
    totalWeight: 500,
    itemsCount: 1,
  };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NoticeProvider onNotice={() => {}}>{children}</NoticeProvider>
  );
  const opt = (option_id: string, amount: number) => ({
    amount,
    currency: "VND",
    rate_id: 7,
    option_id,
    delivery_type: "STANDARD",
    display_name: option_id,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opts into carrier options only when asked", async () => {
    calculate.mockResolvedValue([]);
    renderHook(
      () => useShippingCalculation({ ...base, includeCarrierOptions: true }),
      { wrapper }
    );
    await waitFor(() => expect(calculate).toHaveBeenCalled(), {
      timeout: 3000,
    });
    expect(calculate).toHaveBeenLastCalledWith(
      "s1",
      expect.objectContaining({ include_carrier_options: true })
    );

    calculate.mockClear();
    renderHook(() => useShippingCalculation(base), { wrapper });
    await waitFor(() => expect(calculate).toHaveBeenCalled(), {
      timeout: 3000,
    });
    expect(calculate.mock.calls[0][1]).not.toHaveProperty(
      "include_carrier_options"
    );
  });

  it("exposes the selected option object", async () => {
    calculate.mockResolvedValue([opt("7:a", 30000), opt("7:b", 20000)]);
    const { result } = renderHook(
      () => useShippingCalculation({ ...base, includeCarrierOptions: true }),
      { wrapper }
    );
    await waitFor(
      () => expect(result.current.selectedOption?.option_id).toBe("7:b"),
      {
        timeout: 3000,
      }
    );
    act(() => result.current.handleShippingOptionSelect("7:a"));
    expect(result.current.selectedOptionId).toBe("7:a");
    expect(result.current.selectedOption?.option_id).toBe("7:a");
  });
});

describe("useShippingCalculation in a store preview", () => {
  const props = {
    storeRef: "s1",
    city: "79",
    ward: "26734",
    subtotal: 100,
    totalWeight: 500,
    itemsCount: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    isPreview.mockReturnValue(false);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  function render() {
    const onNotice = vi.fn();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <NoticeProvider onNotice={onNotice}>{children}</NoticeProvider>
    );
    const hook = renderHook(() => useShippingCalculation(props), { wrapper });
    return { onNotice, hook };
  }

  it("does not send the quote and shows the read-only notice", async () => {
    isPreview.mockReturnValue(true);
    const { onNotice, hook } = render();

    await waitFor(
      () => expect(onNotice).toHaveBeenCalledWith(STORE_PREVIEW_READ_ONLY_NOTICE),
      { timeout: 3000 }
    );
    expect(calculate).not.toHaveBeenCalled();
    expect(hook.result.current.calculationFailed).toBe(false);
  });

  it("treats a STORE_COMING_SOON refusal as the notice, not a shipping error", async () => {
    calculate.mockImplementation(
      () =>
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(new ApiClientError("closed", 403, "STORE_COMING_SOON")),
            20
          )
        )
    );
    const { onNotice } = render();

    await waitFor(
      () => expect(onNotice).toHaveBeenCalledWith(STORE_PREVIEW_READ_ONLY_NOTICE),
      { timeout: 3000 }
    );
    expect(onNotice).not.toHaveBeenCalledWith(
      expect.objectContaining({ code: "shipping.quote_failed" })
    );
  });
});
