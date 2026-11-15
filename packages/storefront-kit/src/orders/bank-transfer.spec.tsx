// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import {
  pickBankTransfer,
  shouldShowBankTransferDetails,
  useBankTransferDetails,
} from "./bank-transfer";

const m = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("../api/client", () => ({ publicApiClient: { get: m.get } }));
vi.mock("../api/response", () => ({ unwrap: (r: unknown) => r }));
vi.mock("../store/store-context", () => ({ useStoreId: () => "s1" }));

const account = {
  id: 1,
  bank_name: "Vietcombank",
  bank_code: "VCB",
  account_number: "0123456789",
  account_holder: "Nguyen Van A",
};

describe("shouldShowBankTransferDetails", () => {
  const order = {
    payment_method: "bank_transfer",
    payment_status: "pending",
    order_status: "pending",
  };

  it("shows for an unpaid bank transfer order", () => {
    expect(shouldShowBankTransferDetails(order)).toBe(true);
    expect(
      shouldShowBankTransferDetails({ ...order, order_status: "confirmed" })
    ).toBe(true);
  });

  it("hides once the order is paid or no longer pending payment", () => {
    for (const payment_status of ["paid", "captured", "refunded", "failed"]) {
      expect(shouldShowBankTransferDetails({ ...order, payment_status })).toBe(
        false
      );
    }
  });

  it("hides for other payment methods", () => {
    expect(
      shouldShowBankTransferDetails({ ...order, payment_method: "cod" })
    ).toBe(false);
  });

  it("hides for a cancelled order", () => {
    expect(
      shouldShowBankTransferDetails({ ...order, order_status: "cancelled" })
    ).toBe(false);
  });

  it("hides with no order", () => {
    expect(shouldShowBankTransferDetails(null)).toBe(false);
    expect(shouldShowBankTransferDetails(undefined)).toBe(false);
  });
});

describe("pickBankTransfer", () => {
  it("takes the bank_transfer method's accounts and instruction", () => {
    expect(
      pickBankTransfer([
        { payment_method: "cod", description: "COD" },
        {
          payment_method: "bank_transfer",
          description: "Chọn để chuyển khoản",
          transfer_instruction: "Ghi mã đơn",
          bank_accounts: [account],
        },
      ])
    ).toEqual({ accounts: [account], note: "Ghi mã đơn" });
  });

  it("yields nothing when the method is missing or the response is malformed", () => {
    expect(pickBankTransfer([{ payment_method: "cod" }])).toEqual({
      accounts: [],
      note: null,
    });
    expect(pickBankTransfer(null)).toEqual({ accounts: [], note: null });
    expect(
      pickBankTransfer([
        { payment_method: "bank_transfer", transfer_instruction: "" },
      ])
    ).toEqual({ accounts: [], note: null });
  });
});

describe("useBankTransferDetails", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches nothing while disabled", async () => {
    const { result } = renderHook(() => useBankTransferDetails(false));
    await new Promise(r => setTimeout(r, 10));
    expect(m.get).not.toHaveBeenCalled();
    expect(result.current).toEqual({
      accounts: [],
      note: null,
      isLoading: false,
    });
  });

  it("loads the store's accounts when enabled", async () => {
    m.get.mockResolvedValue([
      {
        payment_method: "bank_transfer",
        transfer_instruction: "Ghi mã đơn",
        bank_accounts: [account],
      },
    ]);
    const { result } = renderHook(() => useBankTransferDetails(true));
    await waitFor(() => expect(result.current.accounts).toHaveLength(1));
    expect(result.current.note).toBe("Ghi mã đơn");
    expect(result.current.isLoading).toBe(false);
    expect(m.get).toHaveBeenCalledWith("/public/stores/s1/payment-methods");
  });

  it("falls back to no accounts when the request fails", async () => {
    m.get.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useBankTransferDetails(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.accounts).toEqual([]);
    expect(result.current.note).toBeNull();
  });
});
