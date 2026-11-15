// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { NoticeProvider } from "../notices";
import { CartProvider, useCart } from "./server-context";
import { setBrowserStorePreviewToken } from "../api/store-preview-header";
import { STORE_PREVIEW_READ_ONLY_NOTICE } from "../stores/store-preview-guard";

const api = vi.hoisted(() => ({
  getCart: vi.fn(),
  addToCart: vi.fn(),
  removeFromCart: vi.fn(),
  updateCartItem: vi.fn(),
  clearCart: vi.fn(),
  mergeCarts: vi.fn(),
}));
vi.mock("./api", () => ({ cartApiService: api }));

const EMPTY_CART = {
  id: "cart_1",
  items: [],
  total: 0,
  subtotal: 0,
  original_subtotal: 0,
  discount_amount: 0,
  shipping_fee: 0,
  item_count: 0,
};

const ITEM = { id: "p1", productId: 1, name: "Áo thun", price: 100, image: "" };

function setup(userId?: string) {
  const onNotice = vi.fn();
  let currentUser = userId;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NoticeProvider onNotice={onNotice}>
      <CartProvider storeRef="s1" userId={currentUser}>
        {children}
      </CartProvider>
    </NoticeProvider>
  );
  const hook = renderHook(() => useCart(), { wrapper });
  return {
    ...hook,
    onNotice,
    signIn(id: string) {
      currentUser = id;
      hook.rerender();
    },
  };
}

describe("CartProvider notices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    api.getCart.mockResolvedValue(EMPTY_CART);
  });

  it("reports a failed add as an error notice and does not throw", async () => {
    api.addToCart.mockRejectedValue(new Error("boom"));
    const { result, onNotice } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.addItem(ITEM));

    expect(onNotice).toHaveBeenCalledWith({
      kind: "error",
      code: "cart.add_failed",
      title: "Lỗi",
      description: "Không thể thêm sản phẩm vào giỏ hàng",
    });
  });

  it("reports an added item with its name", async () => {
    api.addToCart.mockResolvedValue({});
    const { result, onNotice } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.addItem(ITEM));

    expect(onNotice).toHaveBeenCalledWith({
      kind: "success",
      code: "cart.item_added",
      title: "Đã thêm vào giỏ hàng",
      description: "Áo thun đã được thêm vào giỏ hàng của bạn",
      data: { productName: "Áo thun" },
    });
  });

  it("clearCart notifies once by default and not at all when asked", async () => {
    api.clearCart.mockResolvedValue({});
    const { result, onNotice } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(() => result.current.clearCart());
    expect(onNotice).toHaveBeenCalledOnce();
    expect(onNotice.mock.calls[0][0]).toMatchObject({
      kind: "success",
      code: "cart.cleared",
    });

    await act(() => result.current.clearCart(false));
    expect(onNotice).toHaveBeenCalledOnce();
  });

  describe("in a store preview", () => {
    afterEach(() => setBrowserStorePreviewToken(null));

    it("in a store preview, writes send nothing and show the preview notice", async () => {
      setBrowserStorePreviewToken("t");
      const { result, onNotice } = setup();
      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(api.getCart).toHaveBeenCalledWith("s1", false);

      await act(() => result.current.addItem(ITEM));
      await act(() => result.current.removeItem("i1"));
      await act(() => result.current.updateQuantity("i1", 2));
      await act(() => result.current.clearCart());

      expect(api.addToCart).not.toHaveBeenCalled();
      expect(api.removeFromCart).not.toHaveBeenCalled();
      expect(api.updateCartItem).not.toHaveBeenCalled();
      expect(api.clearCart).not.toHaveBeenCalled();
      expect(onNotice).toHaveBeenCalledTimes(4);
      for (const [notice] of onNotice.mock.calls) {
        expect(notice).toEqual(STORE_PREVIEW_READ_ONLY_NOTICE);
      }
      expect(onNotice).not.toHaveBeenCalledWith(
        expect.objectContaining({ code: "cart.add_failed" })
      );
    });

    it("refuses a reorder and a cart merge without a request", async () => {
      setBrowserStorePreviewToken("t");
      const { result, onNotice } = setup();
      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let outcome: { added: number; total: number } | undefined;
      await act(async () => {
        outcome = await result.current.reorderItems([
          { product_id: 1, quantity: 1 },
          { product_id: 2, quantity: 3 },
        ]);
      });
      await act(() => result.current.mergeCarts("c1"));

      expect(outcome).toEqual({ added: 0, total: 2 });
      expect(api.addToCart).not.toHaveBeenCalled();
      expect(api.mergeCarts).not.toHaveBeenCalled();
      expect(onNotice.mock.calls).toEqual([
        [STORE_PREVIEW_READ_ONLY_NOTICE],
        [STORE_PREVIEW_READ_ONLY_NOTICE],
      ]);
    });
  });

  const line = (id: string, created_at: string, quantity = 1) => ({
    id,
    product_id: 7,
    variant_id: 70,
    product_name: id,
    price: 100,
    quantity,
    created_at,
  });
  const cartWith = (...items: ReturnType<typeof line>[]) => ({
    ...EMPTY_CART,
    items,
    item_count: items.length,
  });

  it("keeps cart lines in the order they were added", async () => {
    api.getCart.mockResolvedValue(
      cartWith(
        line("second", "2026-11-08T10:00:02Z"),
        line("first", "2026-11-08T10:00:01Z")
      )
    );
    const { result } = setup();
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items.map(i => i.id)).toEqual(["first", "second"]);
  });

  it("moves the guest cart into the account when the shopper signs in", async () => {
    const guest = cartWith(line("g1", "2026-11-08T10:00:01Z", 2));
    const account = cartWith(line("a1", "2026-11-08T10:00:03Z", 2));
    api.addToCart.mockResolvedValue(account);
    api.getCart.mockImplementation(async (_ref: string, isAuth: boolean) =>
      isAuth ? account : guest
    );
    const { result, signIn } = setup();
    await waitFor(() => expect(result.current.items[0]?.id).toBe("g1"));

    signIn("c1");

    await waitFor(() => expect(result.current.items[0]?.id).toBe("a1"));
    expect(api.addToCart).toHaveBeenCalledWith(
      "s1",
      { product_id: 7, variant_id: 70, quantity: 2 },
      true
    );
    expect(api.removeFromCart).toHaveBeenCalledWith("s1", "g1", false);
  });

  it("leaves a guest line in place when it cannot be moved", async () => {
    const guest = cartWith(line("g1", "2026-11-08T10:00:01Z"));
    api.addToCart.mockRejectedValue(new Error("out of stock"));
    api.getCart.mockImplementation(async (_ref: string, isAuth: boolean) =>
      isAuth ? EMPTY_CART : guest
    );
    const { result, signIn } = setup();
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    signIn("c1");

    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(api.removeFromCart).not.toHaveBeenCalled();
  });

  it("does not keep showing the guest cart when the account has no cart", async () => {
    const guest = cartWith(line("g1", "2026-11-08T10:00:01Z"));
    api.addToCart.mockRejectedValue(new Error("out of stock"));
    api.getCart.mockImplementation(async (_ref: string, isAuth: boolean) =>
      isAuth ? null : guest
    );
    const { result, signIn } = setup();
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    signIn("c1");

    await waitFor(() => expect(result.current.items).toHaveLength(0));
    expect(result.current.isLoading).toBe(false);
  });

  it("switches to the signed-in cart when the shopper signs in, without a client-side merge", async () => {
    const { result, signIn } = setup();
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(api.getCart).toHaveBeenLastCalledWith("s1", false);

    signIn("c1");

    await waitFor(() =>
      expect(api.getCart).toHaveBeenLastCalledWith("s1", true)
    );
    expect(api.mergeCarts).not.toHaveBeenCalled();
  });
});
