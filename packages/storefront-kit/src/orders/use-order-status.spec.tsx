// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useOrderLookup, useOrderStatus } from "./use-order-status";

const m = vi.hoisted(() => ({
  getPaymentState: vi.fn(),
  readOrderHandoff: vi.fn(),
  get: vi.fn(),
  lookupGuest: vi.fn(),
}));
vi.mock("../checkout/get-payment-state", () => ({
  getPaymentState: m.getPaymentState,
}));
vi.mock("../checkout/order-handoff", () => ({
  readOrderHandoff: m.readOrderHandoff,
}));
vi.mock("../api/client", () => ({ publicApiClient: { get: m.get } }));
vi.mock("../api/response", () => ({ unwrap: (r: unknown) => r }));
vi.mock("../sdk", () => ({ sdk: { orders: { lookupGuest: m.lookupGuest } } }));
vi.mock("../store/store-context", () => ({ useStoreId: () => "s1" }));

const instant = () => Promise.resolve();

describe("useOrderStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.readOrderHandoff.mockReturnValue(null);
  });

  it("shows an offline order as placed without polling", async () => {
    m.readOrderHandoff.mockReturnValue({
      order_code: "ORD-1",
      payment_method: "cod",
      provider_code: null,
    });
    const { result } = renderHook(() =>
      useOrderStatus({ orderCode: "ORD-1", wait: instant })
    );
    await waitFor(() => expect(result.current.payment.state).toBe("placed"));
    expect(result.current.handoff?.payment_method).toBe("cod");
    expect(result.current.payment.isPolling).toBe(false);
    expect(m.getPaymentState).not.toHaveBeenCalled();
  });

  it("polls a gateway return until the payment is confirmed", async () => {
    m.getPaymentState
      .mockResolvedValueOnce({ payment_status: "pending" })
      .mockResolvedValueOnce({ payment_status: "paid" });
    const { result } = renderHook(() =>
      useOrderStatus({ orderCode: "ORD-2", wait: instant })
    );
    await waitFor(() => expect(result.current.payment.state).toBe("paid"));
    expect(m.getPaymentState).toHaveBeenCalledTimes(2);
    expect(m.getPaymentState).toHaveBeenCalledWith("s1", "ORD-2");
    expect(result.current.payment.isPolling).toBe(false);
  });

  it("reports an exhausted poll as still confirming, never failed", async () => {
    m.getPaymentState.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() =>
      useOrderStatus({ orderCode: "ORD-3", wait: instant })
    );
    await waitFor(() =>
      expect(result.current.payment.state).toBe("still-confirming")
    );
  });

  it("stops polling when the page goes away", async () => {
    m.getPaymentState.mockResolvedValue({ payment_status: "pending" });
    let release: () => void = () => {};
    const gate = () => new Promise<void>(r => (release = r));
    const { unmount } = renderHook(() =>
      useOrderStatus({ orderCode: "ORD-4", wait: gate })
    );
    await waitFor(() => expect(m.getPaymentState).toHaveBeenCalledOnce());
    unmount();
    await act(async () => release());
    await new Promise(r => setTimeout(r, 20));
    expect(m.getPaymentState).toHaveBeenCalledOnce();
  });

  it("loads transfer details for a bank transfer order", async () => {
    m.readOrderHandoff.mockReturnValue({
      order_code: "ORD-5",
      payment_method: "bank_transfer",
      provider_code: null,
    });
    m.get.mockResolvedValue([
      { payment_method: "cod" },
      {
        payment_method: "bank_transfer",
        transfer_instruction: "Ghi mã đơn",
        bank_accounts: [
          {
            id: 1,
            bank_name: "VCB",
            bank_code: "VCB",
            account_number: "1",
            account_holder: "A",
          },
        ],
      },
    ]);
    const { result } = renderHook(() =>
      useOrderStatus({ orderCode: "ORD-5", wait: instant })
    );
    await waitFor(() =>
      expect(result.current.bankTransfer.accounts).toHaveLength(1)
    );
    expect(result.current.payment.state).toBe("awaiting-transfer");
    expect(result.current.bankTransfer.note).toBe("Ghi mã đơn");
    expect(m.get).toHaveBeenCalledWith("/public/stores/s1/payment-methods");
  });
});

describe("useOrderLookup", () => {
  beforeEach(() => vi.clearAllMocks());

  it("needs an email or a phone", async () => {
    const { result } = renderHook(() => useOrderLookup({ orderCode: "ORD-1" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(
      "Thiếu thông tin cần thiết để tra cứu đơn hàng"
    );
    expect(m.lookupGuest).not.toHaveBeenCalled();
  });

  it("finds the order by code and contact", async () => {
    m.lookupGuest.mockResolvedValue({ order_code: "ORD-1" });
    const { result } = renderHook(() =>
      useOrderLookup({ orderCode: "ORD-1", phone: "0901" })
    );
    await waitFor(() =>
      expect(result.current.order).toEqual({ order_code: "ORD-1" })
    );
    expect(m.lookupGuest).toHaveBeenCalledWith("s1", {
      order_code: "ORD-1",
      customer_email: undefined,
      customer_phone: "0901",
    });
    expect(result.current.error).toBeNull();
  });

  it("says when no order matches", async () => {
    m.lookupGuest.mockResolvedValue(null);
    const { result } = renderHook(() =>
      useOrderLookup({ orderCode: "X", email: "a@b.c" })
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe(
      "Không tìm thấy đơn hàng với thông tin đã cung cấp"
    );
  });

  it("surfaces a failed request as an error and can retry", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    m.lookupGuest
      .mockRejectedValueOnce(new Error("500"))
      .mockResolvedValueOnce({ order_code: "ORD-1" });
    const { result } = renderHook(() =>
      useOrderLookup({ orderCode: "ORD-1", email: "a@b.c" })
    );
    await waitFor(() =>
      expect(result.current.error).toBe("Có lỗi xảy ra khi tra cứu đơn hàng")
    );
    await act(() => result.current.retry());
    expect(result.current.order).toEqual({ order_code: "ORD-1" });
    expect(result.current.error).toBeNull();
  });
});
