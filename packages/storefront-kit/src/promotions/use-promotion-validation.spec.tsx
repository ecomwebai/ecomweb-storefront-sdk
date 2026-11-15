// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { NoticeProvider } from "../notices";
import { usePromotionValidation } from "./use-promotion-validation";

const validate = vi.hoisted(() => vi.fn());
vi.mock("../sdk", () => ({ sdk: { promotions: { validate } } }));

function setup() {
  const onNotice = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NoticeProvider onNotice={onNotice}>{children}</NoticeProvider>
  );
  const hook = renderHook(
    () =>
      usePromotionValidation({
        storeRef: "s1",
        items: [{ productId: 1, variantId: null, quantity: 1, price: 100 }],
        subtotal: 100,
        shippingFee: 0,
      }),
    { wrapper }
  );
  return { ...hook, onNotice };
}

describe("usePromotionValidation notices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("reports an applied code as a success notice", async () => {
    validate.mockResolvedValue({
      success: true,
      promotion: { name: "Giảm 10%" },
    });
    const { result, onNotice } = setup();

    await act(() => result.current.applyPromotionFromSuggestion("SALE10"));

    expect(onNotice).toHaveBeenCalledWith({
      kind: "success",
      code: "promotion.applied",
      title: "Áp dụng mã khuyến mãi thành công",
      description: "Giảm 10% đã được áp dụng",
    });
  });

  it("shows an invalid code inline, not as a notice", async () => {
    validate.mockResolvedValue({ success: false, message: "Hết hạn" });
    const { result, onNotice } = setup();

    await act(() => result.current.applyPromotionFromSuggestion("OLD"));

    expect(result.current.promoError).toBe("Hết hạn");
    expect(onNotice).not.toHaveBeenCalled();
  });
});
