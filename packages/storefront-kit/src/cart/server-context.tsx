"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { useNotify } from "../notices";
import { isBrowserStorePreview } from "../api/store-preview-header";
import { STORE_PREVIEW_READ_ONLY_NOTICE } from "../stores/store-preview-guard";
import { CartItem } from "./types";
import { cartApiService, CartApiResponse, CartApiItem } from "./api";

interface CartState {
  items: CartItem[];
  total: number;
  subtotal: number;
  originalSubtotal: number;
  discountAmount: number;
  shippingFee: number;
  itemCount: number;
  isLoading: boolean;
  cartId?: string;
  sessionId?: string;
}

type CartAction =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "LOAD_CART"; payload: CartApiResponse }
  | { type: "SET_SESSION_ID"; payload: string }
  | { type: "CLEAR_CART" };

const cartReducer = (state: CartState, action: CartAction): CartState => {
  switch (action.type) {
    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "LOAD_CART": {
      const cart = action.payload;
      // The API returns lines in no fixed order, and an updated line moves.
      // Without this, the row under the shopper's finger swaps mid-tap.
      const inAddedOrder = [...cart.items].sort(
        (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
      );
      const items: CartItem[] = inAddedOrder.map((item: CartApiItem) => ({
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id ?? undefined,
        name: item.product_name,
        price: item.price,
        originalPrice: item.original_price,
        image: item.product_image,
        quantity: item.quantity,
        variantName: item.variant_name,
        variantOptions: item.variant_options,
        promotions: item.promotions,
        bestPromotion: item.best_promotion,
      }));

      return {
        ...state,
        items,
        total: cart.total,
        subtotal: cart.subtotal,
        originalSubtotal: cart.original_subtotal,
        discountAmount: cart.discount_amount,
        shippingFee: cart.shipping_fee,
        itemCount: cart.item_count,
        cartId: cart.id,
        isLoading: false,
      };
    }

    case "SET_SESSION_ID":
      return {
        ...state,
        sessionId: action.payload,
      };

    case "CLEAR_CART":
      return {
        ...state,
        items: [],
        total: 0,
        subtotal: 0,
        originalSubtotal: 0,
        discountAmount: 0,
        shippingFee: 0,
        itemCount: 0,
        cartId: undefined,
      };

    default:
      return state;
  }
};

interface CartContextType extends CartState {
  addItem: (
    item: Omit<CartItem, "quantity"> & { quantity?: number }
  ) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  /** Pass false to skip the "cart cleared" notice (e.g. after checkout). */
  clearCart: (notifyCleared?: boolean) => Promise<void>;
  refreshCart: () => Promise<void>;
  mergeCarts: (userId: string) => Promise<void>;
  reorderItems: (
    items: { product_id: number; variant_id?: number; quantity: number }[]
  ) => Promise<{ added: number; total: number }>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

interface CartProviderProps {
  children: ReactNode;
  storeRef: string;
  userId?: string;
}

export function CartProvider({
  children,
  storeRef,
  userId,
}: CartProviderProps) {
  // A signed-in shopper gets the identity-scoped cart; everyone else gets the
  // session-id cart. `userId` comes from the auth context one level up
  // (StoreCartProvider) — this module can never read the httpOnly cookie itself.
  const isAuth = !!userId;
  const notify = useNotify();
  const [state, dispatch] = useReducer(cartReducer, {
    items: [],
    total: 0,
    subtotal: 0,
    originalSubtotal: 0,
    discountAmount: 0,
    shippingFee: 0,
    itemCount: 0,
    isLoading: true, // Start with loading true to show loading state on initial render
  });

  // Generate session ID for anonymous users
  useEffect(() => {
    if (!userId && !state.sessionId) {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      dispatch({ type: "SET_SESSION_ID", payload: sessionId });
    }
  }, [userId, state.sessionId]);

  // Load cart from server
  const loadCart = useCallback(async () => {
    if (!storeRef) return;

    dispatch({ type: "SET_LOADING", payload: true });
    try {
      const cart = await cartApiService.getCart(storeRef, isAuth);

      if (cart) {
        dispatch({ type: "LOAD_CART", payload: cart });
      } else {
        // No cart for this identity. Keeping the state would show the
        // previous identity's items (guest before sign-in, account after
        // sign-out) as if they could be bought.
        dispatch({ type: "CLEAR_CART" });
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch (error) {
      console.error("Failed to load cart:", error);
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [storeRef, isAuth]);

  // Shared while running: the provider's effect can fire twice for one sign-in.
  const movingGuestCart = useRef<Promise<void> | null>(null);

  /**
   * Signing in switches to the account's cart, so without this whatever the
   * shopper added as a guest disappears, even on checkout's own "sign in and
   * come back" link. Each line is added before it is removed, and a line that
   * cannot be added stays in the guest cart, so nothing is lost on a failure.
   */
  const moveGuestCartToAccount = useCallback(() => {
    if (!movingGuestCart.current) {
      movingGuestCart.current = (async () => {
        try {
          const guestCart = await cartApiService.getCart(storeRef, false);
          for (const item of guestCart?.items ?? []) {
            try {
              await cartApiService.addToCart(
                storeRef,
                {
                  product_id: item.product_id,
                  variant_id: item.variant_id ?? undefined,
                  quantity: item.quantity,
                },
                true
              );
              await cartApiService.removeFromCart(storeRef, item.id, false);
            } catch (error) {
              console.error("Could not move a guest cart line:", error);
            }
          }
        } catch (error) {
          console.error("Could not read the guest cart:", error);
        } finally {
          movingGuestCart.current = null;
        }
      })();
    }
    return movingGuestCart.current;
  }, [storeRef]);

  // Load cart on mount and when dependencies change
  useEffect(() => {
    if (!storeRef || !isAuth || isBrowserStorePreview()) {
      loadCart();
      return;
    }
    dispatch({ type: "SET_LOADING", payload: true });
    moveGuestCartToAccount().then(loadCart);
  }, [storeRef, isAuth, loadCart, moveGuestCartToAccount]);

  const addItem = async (
    item: Omit<CartItem, "quantity"> & { quantity?: number }
  ) => {
    if (isBrowserStorePreview()) {
      notify(STORE_PREVIEW_READ_ONLY_NOTICE);
      return;
    }
    if (!storeRef) return;

    try {
      await cartApiService.addToCart(
        storeRef,
        {
          product_id: item.productId,
          variant_id: item.variantId,
          quantity: item.quantity || 1,
        },
        isAuth
      );

      // Refresh cart after adding item
      await loadCart();

      notify({
        kind: "success",
        code: "cart.item_added",
        title: "Đã thêm vào giỏ hàng",
        description: `${item.name} đã được thêm vào giỏ hàng của bạn`,
        data: { productName: item.name },
      });
    } catch (error) {
      console.error("Failed to add item to cart:", error);
      notify({
        kind: "error",
        code: "cart.add_failed",
        title: "Lỗi",
        description: "Không thể thêm sản phẩm vào giỏ hàng",
      });
    }
  };

  /**
   * Add every line of a past order back to the cart.
   *
   * Deliberately not a loop over addItem: that notifies per item and swallows
   * its errors, so a reorder would fire one notice per line and the caller
   * could never report a shortfall. This refreshes once and returns counts.
   */
  const reorderItems = async (
    items: { product_id: number; variant_id?: number; quantity: number }[]
  ): Promise<{ added: number; total: number }> => {
    if (isBrowserStorePreview()) {
      notify(STORE_PREVIEW_READ_ONLY_NOTICE);
      return { added: 0, total: items.length };
    }
    if (!storeRef) return { added: 0, total: items.length };

    let added = 0;
    for (const item of items) {
      try {
        await cartApiService.addToCart(
          storeRef,
          {
            product_id: item.product_id,
            variant_id: item.variant_id,
            quantity: item.quantity,
          },
          isAuth
        );
        added += 1;
      } catch (error) {
        // Product deleted, out of stock, or repriced since purchase. Skip it —
        // the caller reports the shortfall rather than failing the reorder.
        console.error("Reorder skipped an item:", error);
      }
    }

    await loadCart();
    return { added, total: items.length };
  };

  const removeItem = async (id: string) => {
    if (isBrowserStorePreview()) {
      notify(STORE_PREVIEW_READ_ONLY_NOTICE);
      return;
    }
    if (!storeRef) return;

    const item = state.items.find(item => item.id === id);

    try {
      await cartApiService.removeFromCart(storeRef, id, isAuth);

      // Refresh cart after removing item
      await loadCart();

      if (item) {
        notify({
          kind: "success",
          code: "cart.item_removed",
          title: "Đã xóa khỏi giỏ hàng",
          description: `${item.name} đã được xóa khỏi giỏ hàng`,
          data: { productName: item.name },
        });
      }
    } catch (error) {
      console.error("Failed to remove item from cart:", error);
      notify({
        kind: "error",
        code: "cart.remove_failed",
        title: "Lỗi",
        description: "Không thể xóa sản phẩm khỏi giỏ hàng",
      });
    }
  };

  const updateQuantity = async (id: string, quantity: number) => {
    if (isBrowserStorePreview()) {
      notify(STORE_PREVIEW_READ_ONLY_NOTICE);
      return;
    }
    if (!storeRef) return;

    try {
      await cartApiService.updateCartItem(storeRef, id, { quantity }, isAuth);

      // Refresh cart after updating quantity
      await loadCart();
    } catch (error) {
      console.error("Failed to update item quantity:", error);
      notify({
        kind: "error",
        code: "cart.update_failed",
        title: "Lỗi",
        description: "Không thể cập nhật số lượng sản phẩm",
      });
    }
  };

  const clearCart = async (notifyCleared: boolean = true) => {
    if (isBrowserStorePreview()) {
      notify(STORE_PREVIEW_READ_ONLY_NOTICE);
      return;
    }
    if (!storeRef) return;

    try {
      await cartApiService.clearCart(storeRef, isAuth);

      dispatch({ type: "CLEAR_CART" });

      if (notifyCleared) {
        notify({
          kind: "success",
          code: "cart.cleared",
          title: "Đã xóa giỏ hàng",
          description: "Tất cả sản phẩm đã được xóa khỏi giỏ hàng",
        });
      }
    } catch (error) {
      console.error("Failed to clear cart:", error);
      notify({
        kind: "error",
        code: "cart.clear_failed",
        title: "Lỗi",
        description: "Không thể xóa giỏ hàng",
      });
    }
  };

  const refreshCart = async () => {
    await loadCart();
  };

  const mergeCarts = async (_userId: string) => {
    if (isBrowserStorePreview()) {
      notify(STORE_PREVIEW_READ_ONLY_NOTICE);
      return;
    }
    if (!storeRef || !state.sessionId) return;

    try {
      await cartApiService.mergeCarts(storeRef);

      // Refresh cart after merging
      await loadCart();

      notify({
        kind: "success",
        code: "cart.merged",
        title: "Đã đồng bộ giỏ hàng",
        description: "Giỏ hàng đã được đồng bộ với tài khoản của bạn",
      });
    } catch (error) {
      console.error("Failed to merge carts:", error);
      notify({
        kind: "error",
        code: "cart.merge_failed",
        title: "Lỗi",
        description: "Không thể đồng bộ giỏ hàng",
      });
    }
  };

  return (
    <CartContext.Provider
      value={{
        ...state,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        refreshCart,
        mergeCarts,
        reorderItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

/**
 * The shopper's cart and the actions to change it: `items`, `itemCount`,
 * `subtotal`, `total`, `discountAmount`, `isLoading`, `addItem`, `removeItem`,
 * `updateQuantity`, `clearCart`, `refreshCart`, `mergeCarts` and
 * `reorderItems`. Amounts are in the store's currency.
 *
 * Must run under {@link StorefrontKitProvider}, which includes the cart provider.
 *
 * @returns The cart context.
 * @throws When used outside the provider.
 *
 * @example
 * ```tsx
 * "use client";
 * import { useCart } from "@ecomweb/storefront-kit";
 *
 * export function CartBadge() {
 *   const { itemCount, isLoading } = useCart();
 *   return <span>{isLoading ? "…" : itemCount}</span>;
 * }
 * ```
 */
export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
