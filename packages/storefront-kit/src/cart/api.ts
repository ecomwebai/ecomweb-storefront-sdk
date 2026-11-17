import { createStoreSdk } from "../sdk";

export type {
  CartApiItem,
  CartApiResponse,
  AddToCartRequest,
  UpdateCartItemRequest,
} from "@ecomweb/sdk";

export interface MergeCartsRequest {
  // No body needed, user_id comes from header
}

/**
 * Plain module, not a component, so it cannot read React context or an
 * httpOnly cookie. `storeRef` and `isAuth` are therefore explicit parameters
 * supplied by `CartProvider`. When `isAuth` is true the SDK takes the
 * JWT-guarded `/storefront/stores/:ref/customers/cart` branch, which reaches the backend through the
 * same-origin proxy (`lib/api/proxy.ts`) — that is what attaches the bearer
 * token server-side.
 */
class CartApiService {
  private getSessionId(): string {
    if (typeof window === "undefined") return "";

    let sessionId = localStorage.getItem("cart_session_id");
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem("cart_session_id", sessionId);
    }
    return sessionId;
  }

  async getCart(storeRef: string, isAuth: boolean) {
    return createStoreSdk(storeRef).cart.getCart(
      storeRef,
      this.getSessionId(),
      isAuth
    );
  }

  async addToCart(
    storeRef: string,
    data: Parameters<ReturnType<typeof createStoreSdk>["cart"]["addItem"]>[1],
    isAuth: boolean
  ) {
    return createStoreSdk(storeRef).cart.addItem(
      storeRef,
      data,
      this.getSessionId(),
      isAuth
    );
  }

  async updateCartItem(
    storeRef: string,
    itemId: string,
    data: Parameters<
      ReturnType<typeof createStoreSdk>["cart"]["updateItem"]
    >[2],
    isAuth: boolean
  ) {
    return createStoreSdk(storeRef).cart.updateItem(
      storeRef,
      itemId,
      data,
      this.getSessionId(),
      isAuth
    );
  }

  async removeFromCart(storeRef: string, itemId: string, isAuth: boolean) {
    return createStoreSdk(storeRef).cart.removeItem(
      storeRef,
      itemId,
      this.getSessionId(),
      isAuth
    );
  }

  async clearCart(storeRef: string, isAuth: boolean) {
    return createStoreSdk(storeRef).cart.clear(
      storeRef,
      this.getSessionId(),
      isAuth
    );
  }

  /** Always authenticated: merging a guest cart needs an identity to merge into. */
  async mergeCarts(storeRef: string) {
    return createStoreSdk(storeRef).cart.merge(storeRef, this.getSessionId());
  }
}

export const cartApiService = new CartApiService();
