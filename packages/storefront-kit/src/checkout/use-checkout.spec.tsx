// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { NoticeProvider } from "../notices";
import { useCheckout, type PlaceOrderInput } from "./use-checkout";
import { setBrowserStorePreviewToken } from "../api/store-preview-header";
import { STORE_PREVIEW_READ_ONLY_MESSAGE } from "../stores/store-preview-guard";

const m = vi.hoisted(() => ({
  getEnabled: vi.fn(),
  calculate: vi.fn(),
  validate: vi.fn(),
  createStoreOrder: vi.fn(),
  initiateGatewayPayment: vi.fn(),
  writeOrderHandoff: vi.fn(),
  clearCart: vi.fn(),
  auth: { user: null as { id: string } | null, isAnonymous: false },
}));

vi.mock("../sdk", () => ({
  sdk: { paymentMethods: { getEnabled: m.getEnabled } },
  createStoreSdk: () => ({
    shipping: { calculate: m.calculate },
    promotions: { validate: m.validate },
  }),
}));
vi.mock("../orders/api-client", () => ({
  publicOrdersApi: { createStoreOrder: m.createStoreOrder },
}));
vi.mock("./initiate-gateway-payment", () => ({
  initiateGatewayPayment: m.initiateGatewayPayment,
}));
vi.mock("./order-handoff", () => ({ writeOrderHandoff: m.writeOrderHandoff }));
vi.mock("../store/store-context", () => ({
  useStoreData: () => ({ ref: "s1" }),
}));
vi.mock("../auth/context", () => ({ useAuth: () => m.auth }));
const ITEMS = [
  {
    id: "l1",
    productId: 1,
    variantId: 11,
    name: "Áo",
    image: "a.jpg",
    quantity: 2,
    price: 100,
  },
];
vi.mock("../cart/server-context", () => ({
  useCart: () => ({
    items: ITEMS,
    total: 200,
    subtotal: 200,
    originalSubtotal: 220,
    discountAmount: 20,
    cartId: "cart_1",
    isLoading: false,
    clearCart: m.clearCart,
  }),
}));

const COD = { payment_method: "cod", provider_code: null };
const GATEWAY = { payment_method: "vnpay", provider_code: "vnpay" };

const ORDER_INPUT: PlaceOrderInput = {
  fullName: "Nguyễn Văn A",
  phone: "0901234567",
  email: "a@example.com",
  street: "1 Lê Lợi",
  province: "79",
  ward: "26734",
  notes: "",
  paymentMethod: "cod",
};

const later = <T,>(value: T, ms = 10) =>
  new Promise<T>(resolve => setTimeout(() => resolve(value), ms));

function setup(
  props: { province: string; ward: string } = { province: "", ward: "" }
) {
  const onNotice = vi.fn();
  const navigateToGateway = vi.fn();
  let current = props;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NoticeProvider onNotice={onNotice}>{children}</NoticeProvider>
  );
  const hook = renderHook(
    () => useCheckout({ ...current, navigateToGateway }),
    { wrapper }
  );
  return {
    ...hook,
    onNotice,
    navigateToGateway,
    setAddress(next: { province: string; ward: string }) {
      current = next;
      hook.rerender();
    },
  };
}

describe("useCheckout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.auth = { user: null, isAnonymous: false };
    m.getEnabled.mockResolvedValue([COD, GATEWAY]);
    m.clearCart.mockResolvedValue(undefined);
    m.calculate.mockImplementation(() =>
      later([{ rate_id: 7, amount: 30, name: "Nhanh" }])
    );
    m.createStoreOrder.mockResolvedValue({ order_code: "ORD-1", total: 230 });
  });

  it("loads the store's payment methods", async () => {
    const { result } = setup();
    expect(result.current.isLoadingPaymentMethods).toBe(true);
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );
    expect(result.current.paymentMethods).toEqual([COD, GATEWAY]);
  });

  it("reports payment methods that fail to load as a notice", async () => {
    m.getEnabled.mockRejectedValue(new Error("down"));
    const { result, onNotice } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );
    expect(onNotice).toHaveBeenCalledWith({
      kind: "error",
      code: "checkout.payment_methods_failed",
      title: "Không thể tải phương thức thanh toán",
      description: "Vui lòng thử lại sau",
    });
  });

  it("places an offline-payment order: handoff written, cart cleared, success", async () => {
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );

    let outcome;
    await act(async () => {
      outcome = await result.current.placeOrder(ORDER_INPUT);
    });

    expect(outcome).toEqual({
      kind: "success",
      order: { order_code: "ORD-1", total: 230 },
    });
    expect(m.createStoreOrder).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({
        cart_id: "cart_1",
        customer_name: "Nguyễn Văn A",
        shipping_city: "79",
        payment_method: "cod",
        items: [
          expect.objectContaining({
            product_id: 1,
            variant_id: 11,
            quantity: 2,
          }),
        ],
      }),
      false
    );
    expect(m.writeOrderHandoff).toHaveBeenCalledWith({
      order_code: "ORD-1",
      payment_method: "cod",
      provider_code: null,
      total: 230,
      currency_code: "VND",
      // No summary passed in: the thank-you page falls back to its basic view.
      summary: null,
    });
    expect(m.clearCart).toHaveBeenCalledWith(false);
    expect(result.current.isSubmitting).toBe(false);
  });

  it("sends a signed-in customer's order through the authenticated route", async () => {
    m.auth = { user: { id: "c1" }, isAnonymous: false };
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );
    await act(() => result.current.placeOrder(ORDER_INPUT));
    expect(m.createStoreOrder.mock.calls[0][2]).toBe(true);
  });

  it("hands a gateway order to the provider", async () => {
    m.initiateGatewayPayment.mockResolvedValue({
      redirect_url: "https://pay.example/x",
    });
    const { result, navigateToGateway } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );

    let outcome;
    await act(async () => {
      outcome = await result.current.placeOrder({
        ...ORDER_INPUT,
        paymentMethod: "vnpay",
      });
    });

    expect(outcome).toEqual({ kind: "redirect" });
    expect(m.initiateGatewayPayment).toHaveBeenCalledWith("s1", {
      order_code: "ORD-1",
      provider_code: "vnpay",
    });
    expect(m.clearCart).toHaveBeenCalledWith(false);
    expect(navigateToGateway).toHaveBeenCalledWith("https://pay.example/x");
    expect(m.writeOrderHandoff).not.toHaveBeenCalled();
  });

  it("retries a failed gateway hand-off for the same order without placing another", async () => {
    m.initiateGatewayPayment
      .mockRejectedValueOnce(new Error("gateway down"))
      .mockResolvedValueOnce({ redirect_url: "https://pay.example/retry" });
    const { result, navigateToGateway } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );

    let first;
    await act(async () => {
      first = await result.current.placeOrder({
        ...ORDER_INPUT,
        paymentMethod: "vnpay",
      });
    });
    expect(first).toEqual({ kind: "redirect_failed", orderCode: "ORD-1" });
    expect(result.current.redirectError).toEqual({
      order_code: "ORD-1",
      provider_code: "vnpay",
    });
    // The order exists, so the cart stays until a redirect actually starts.
    expect(m.clearCart).not.toHaveBeenCalled();

    let retried;
    await act(async () => {
      retried = await result.current.retryPaymentRedirect();
    });
    expect(retried).toEqual({ kind: "redirect" });
    expect(m.createStoreOrder).toHaveBeenCalledOnce();
    expect(m.initiateGatewayPayment).toHaveBeenLastCalledWith("s1", {
      order_code: "ORD-1",
      provider_code: "vnpay",
    });
    expect(navigateToGateway).toHaveBeenCalledWith("https://pay.example/retry");
  });

  it("never places a second order after a failed hand-off", async () => {
    m.initiateGatewayPayment.mockRejectedValue(new Error("gateway down"));
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );
    await act(() =>
      result.current.placeOrder({ ...ORDER_INPUT, paymentMethod: "vnpay" })
    );

    let again;
    await act(async () => {
      again = await result.current.placeOrder({
        ...ORDER_INPUT,
        paymentMethod: "vnpay",
      });
    });

    expect(again).toEqual({ kind: "redirect_failed", orderCode: "ORD-1" });
    expect(m.createStoreOrder).toHaveBeenCalledOnce();
  });

  it("ignores a second placeOrder while one is in flight", async () => {
    let resolveOrder: (v: unknown) => void = () => {};
    m.createStoreOrder.mockImplementation(
      () => new Promise(r => (resolveOrder = r))
    );
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );

    let first: Promise<unknown> | undefined;
    let second;
    await act(async () => {
      first = result.current.placeOrder(ORDER_INPUT);
      second = await result.current.placeOrder(ORDER_INPUT);
    });
    expect(second).toEqual({ kind: "busy" });
    await act(async () => {
      resolveOrder({ order_code: "ORD-1", total: 230 });
      await first;
    });
    expect(m.createStoreOrder).toHaveBeenCalledOnce();
  });

  it("reports a retry that fails again", async () => {
    m.initiateGatewayPayment.mockRejectedValue(new Error("gateway down"));
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );
    await act(() =>
      result.current.placeOrder({ ...ORDER_INPUT, paymentMethod: "vnpay" })
    );

    let retried;
    await act(async () => {
      retried = await result.current.retryPaymentRedirect();
    });
    expect(retried).toEqual({ kind: "redirect_failed", orderCode: "ORD-1" });
    expect(result.current.isRetryingRedirect).toBe(false);
  });

  it("maps a stock shortage to per-line issues", async () => {
    m.createStoreOrder.mockRejectedValue({
      code: "INSUFFICIENT_INVENTORY",
      details: { items: [{ variant_id: 11, requested: 2, available: 1 }] },
    });
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );

    let outcome: { kind: string; issues?: Record<string, string> } | undefined;
    await act(async () => {
      outcome = await result.current.placeOrder(ORDER_INPUT);
    });

    expect(outcome?.kind).toBe("stock_issues");
    expect(Object.keys(outcome?.issues ?? {})).toEqual(["l1"]);
    expect(result.current.stockIssues).toEqual(outcome?.issues);
  });

  it("reports any other failure as an error", async () => {
    m.createStoreOrder.mockRejectedValue(new Error("500"));
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );
    let outcome;
    await act(async () => {
      outcome = await result.current.placeOrder(ORDER_INPUT);
    });
    expect(outcome).toEqual({ kind: "error", message: "500" });
  });

  it.each(["ORDER_PROMOTION_NOT_APPLICABLE", "PROMOTION_USAGE_LIMIT_REACHED"])(
    "passes %s through and drops the promotion the API refused",
    async apiCode => {
      m.validate.mockResolvedValue({
        success: true,
        promotion: { id: 9, name: "FREESHIP" },
        shipping_discount: 10000,
      });
      m.createStoreOrder.mockRejectedValue({ code: apiCode });
      const { result } = setup();
      await waitFor(() =>
        expect(result.current.isLoadingPaymentMethods).toBe(false)
      );
      await act(() => result.current.promotion.applySuggestion("FREESHIP"));
      expect(result.current.promotion.applied).not.toBeNull();

      let outcome: { kind: string; code?: string } | undefined;
      await act(async () => {
        outcome = await result.current.placeOrder(ORDER_INPUT);
      });

      expect(m.createStoreOrder.mock.calls[0][1].promotion_id).toBe(9);
      expect(m.createStoreOrder.mock.calls[0][1].promotion_code).toBe(
        "FREESHIP"
      );
      expect(outcome).toMatchObject({ kind: "error", code: apiCode });
      // Placing again would fail the same way, so the code is gone and the
      // total no longer counts its discount.
      expect(result.current.promotion.applied).toBeNull();
      expect(result.current.promotion.shippingDiscount).toBe(0);
    }
  );

  it("keeps the code on PROMOTION_IDENTITY_REQUIRED so the shopper can add an email", async () => {
    m.validate.mockResolvedValue({
      success: true,
      promotion: { id: 9, name: "ONCE" },
      shipping_discount: 0,
    });
    m.createStoreOrder.mockRejectedValue({
      code: "PROMOTION_IDENTITY_REQUIRED",
    });
    const { result } = setup();
    await waitFor(() =>
      expect(result.current.isLoadingPaymentMethods).toBe(false)
    );
    await act(() => result.current.promotion.applySuggestion("ONCE"));

    let outcome: { kind: string; code?: string } | undefined;
    await act(async () => {
      outcome = await result.current.placeOrder(ORDER_INPUT);
    });

    expect(outcome).toMatchObject({
      kind: "error",
      code: "PROMOTION_IDENTITY_REQUIRED",
    });
    expect(result.current.promotion.applied).not.toBeNull();
  });

  it("refuses to place an order in a store preview", async () => {
    setBrowserStorePreviewToken("t");
    try {
      const { result } = setup();
      await waitFor(() =>
        expect(result.current.isLoadingPaymentMethods).toBe(false)
      );
      let outcome;
      await act(async () => {
        outcome = await result.current.placeOrder(ORDER_INPUT);
      });
      expect(outcome).toEqual({
        kind: "error",
        message: STORE_PREVIEW_READ_ONLY_MESSAGE,
        code: "STORE_COMING_SOON",
      });
      expect(m.createStoreOrder).not.toHaveBeenCalled();
      expect(result.current.isSubmitting).toBe(false);
    } finally {
      setBrowserStorePreviewToken(null);
    }
  });

  it("quotes shipping for the address and adds it to the total", async () => {
    const { result } = setup({ province: "79", ward: "26734" });
    await waitFor(
      () => expect(result.current.shipping.hasCalculated).toBe(true),
      {
        timeout: 3000,
      }
    );
    expect(m.calculate).toHaveBeenCalledOnce();
    expect(result.current.shipping.selectedRate).toBe(7);
    expect(result.current.totals).toEqual({
      subtotal: 200,
      originalSubtotal: 220,
      discount: 20,
      cartTotal: 200,
      shipping: 30,
      shippingDiscount: 0,
      total: 230,
    });
  });

  it("re-quotes once when the address changes", async () => {
    const { result, setAddress } = setup({ province: "79", ward: "26734" });
    await waitFor(
      () => expect(result.current.shipping.hasCalculated).toBe(true),
      {
        timeout: 3000,
      }
    );
    setAddress({ province: "01", ward: "00001" });
    await waitFor(() => expect(m.calculate).toHaveBeenCalledTimes(2), {
      timeout: 3000,
    });
    expect(m.calculate).toHaveBeenLastCalledWith(
      "s1",
      expect.objectContaining({ province_id: "01", ward_id: "00001" })
    );
    await new Promise(r => setTimeout(r, 700));
    expect(m.calculate).toHaveBeenCalledTimes(2);
  });
  describe("carrier shipping options", () => {
    const OPT_A = {
      rate_id: 41,
      option_id: "41:a",
      carrier_service_id: "a",
      amount: 30000,
    };
    const OPT_B = {
      rate_id: 41,
      option_id: "41:b",
      carrier_service_id: "b",
      amount: 22000,
    };
    const ready = async (
      options: unknown[],
      extra: { includeCarrierOptions?: boolean } = {}
    ) => {
      m.calculate.mockImplementation(() => later(options));
      const onNotice = vi.fn();
      const wrapper = ({ children }: { children: ReactNode }) => (
        <NoticeProvider onNotice={onNotice}>{children}</NoticeProvider>
      );
      const hook = renderHook(
        () => useCheckout({ province: "79", ward: "26734", ...extra }),
        { wrapper }
      );
      await waitFor(
        () => expect(hook.result.current.shipping.hasCalculated).toBe(true),
        { timeout: 3000 }
      );
      return hook;
    };

    it("sends the chosen carrier service with its rate", async () => {
      const { result } = await ready([OPT_A, OPT_B]);
      act(() => result.current.shipping.selectOption("41:a"));
      await act(async () => {
        await result.current.placeOrder(ORDER_INPUT);
      });
      expect(m.createStoreOrder).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({
          shipping_rate_id: 41,
          shipping_service_id: "a",
          shipping_quoted_amount: 30000,
        }),
        false
      );
    });

    it("sends no service and no quoted amount for a fixed or older option", async () => {
      const { result } = await ready([
        { rate_id: 7, amount: 30, name: "Nhanh" },
      ]);
      await act(async () => {
        await result.current.placeOrder(ORDER_INPUT);
      });
      const payload = m.createStoreOrder.mock.calls[0][1];
      expect(payload.shipping_rate_id).toBe(7);
      expect(payload).not.toHaveProperty("shipping_service_id");
      expect(payload).not.toHaveProperty("shipping_quoted_amount");
    });

    const changed = {
      code: "SHIPPING_QUOTE_CHANGED",
      details: {
        options: [
          {
            rate_id: 41,
            option_id: "41:a",
            carrier_service_id: "a",
            amount: 33000,
          },
        ],
      },
    };

    it("a changed quote replaces the options and asks to place again", async () => {
      const { result } = await ready([OPT_A, OPT_B]);
      act(() => result.current.shipping.selectOption("41:a"));
      m.createStoreOrder.mockRejectedValueOnce(changed);
      let outcome;
      await act(async () => {
        outcome = await result.current.placeOrder(ORDER_INPUT);
      });
      expect(outcome).toEqual({ kind: "quote_changed" });
      expect(result.current.shipping.selectedOptionId).toBe("41:a");
      expect(result.current.totals.shipping).toBe(33000);
      expect(m.createStoreOrder).toHaveBeenCalledTimes(1);
    });

    it("a changed quote keeps the other carrier options", async () => {
      const { result } = await ready([OPT_A, OPT_B]);
      act(() => result.current.shipping.selectOption("41:a"));
      m.createStoreOrder.mockRejectedValueOnce(changed);
      await act(async () => {
        await result.current.placeOrder(ORDER_INPUT);
      });
      expect(result.current.shipping.options.map(o => o.option_id)).toEqual([
        "41:a",
        "41:b",
      ]);
    });

    it("refreshes the options when the rate is unavailable", async () => {
      const { result } = await ready([OPT_A, OPT_B]);
      m.calculate.mockClear();
      m.createStoreOrder.mockRejectedValueOnce({
        code: "ORDER_SHIPPING_RATE_UNAVAILABLE",
        message: "gone",
      });
      let outcome;
      await act(async () => {
        outcome = await result.current.placeOrder(ORDER_INPUT);
      });
      expect(outcome).toMatchObject({
        kind: "error",
        code: "ORDER_SHIPPING_RATE_UNAVAILABLE",
      });
      await waitFor(() => expect(m.calculate).toHaveBeenCalledTimes(1));
    });

    it("refreshes the options when a changed quote is unusable", async () => {
      const { result } = await ready([OPT_A, OPT_B]);
      m.calculate.mockClear();
      m.createStoreOrder.mockRejectedValueOnce({
        code: "SHIPPING_QUOTE_CHANGED",
        details: { options: [] },
      });
      let outcome;
      await act(async () => {
        outcome = await result.current.placeOrder(ORDER_INPUT);
      });
      expect(outcome).toMatchObject({ kind: "error" });
      await waitFor(() => expect(m.calculate).toHaveBeenCalledTimes(1));
    });

    it("placing again after a changed quote sends the new amount", async () => {
      const { result } = await ready([OPT_A, OPT_B]);
      act(() => result.current.shipping.selectOption("41:a"));
      m.createStoreOrder.mockRejectedValueOnce(changed);
      await act(async () => {
        await result.current.placeOrder(ORDER_INPUT);
      });
      await act(async () => {
        await result.current.placeOrder(ORDER_INPUT);
      });
      expect(m.createStoreOrder).toHaveBeenCalledTimes(2);
      expect(m.createStoreOrder.mock.calls[1][1]).toEqual(
        expect.objectContaining({
          shipping_service_id: "a",
          shipping_quoted_amount: 33000,
        })
      );
    });

    it("a changed quote without usable options is a plain error", async () => {
      const { result } = await ready([OPT_A]);
      m.createStoreOrder.mockRejectedValueOnce({
        code: "SHIPPING_QUOTE_CHANGED",
        details: {},
      });
      let outcome;
      await act(async () => {
        outcome = await result.current.placeOrder(ORDER_INPUT);
      });
      expect(outcome).toEqual(
        expect.objectContaining({
          kind: "error",
          code: "SHIPPING_QUOTE_CHANGED",
        })
      );
    });

    it("passes includeCarrierOptions through", async () => {
      await ready([OPT_A], { includeCarrierOptions: true });
      expect(m.calculate).toHaveBeenCalledWith(
        "s1",
        expect.objectContaining({ include_carrier_options: true })
      );
    });
  });
});
