import type { IHttpClient } from "../../core/types";
import { unwrap, unwrapOrNull } from "../../core/response";
import type {
  CartApiResponse,
  CartApiItem,
  AddToCartRequest,
  UpdateCartItemRequest,
} from "./types";

/**
 * A shopper's cart: a guest cart keyed by a session id, or the signed-in customer's cart, reached through `sdk.cart`.
 */
export class CartApi {
  constructor(
    private privateHttp: IHttpClient,
    private shopperHttp: IHttpClient
  ) {}

  private client(isAuth: boolean) {
    return isAuth ? this.shopperHttp : this.privateHttp;
  }

  /** Guest cart: `/storefront/stores/:ref/cart`; signed-in: `.../customers/cart`. */
  private cartPath(isAuth: boolean, storeRef: string) {
    return isAuth
      ? `/storefront/stores/${storeRef}/customers/cart`
      : `/storefront/stores/${storeRef}/cart`;
  }

  /**
   * Gets the shopper's cart.
   *
   * @param storeRef - the store's ref or handle
   * @param sessionId - the guest cart session id
   * @param isAuth - `true` for the signed-in customer's cart, `false` for the guest cart
   * @returns The cart, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async getCart(
    storeRef: string,
    sessionId: string,
    isAuth: boolean
  ): Promise<CartApiResponse | null> {
    const res = await this.client(isAuth).get<CartApiResponse>(
      this.cartPath(isAuth, storeRef),
      { headers: { "x-session-id": sessionId } }
    );
    return unwrapOrNull(res);
  }

  /**
   * Adds a product variant to the cart.
   *
   * @param storeRef - the store's ref or handle
   * @param data - the variant and the quantity
   * @param sessionId - the guest cart session id
   * @param isAuth - `true` for the signed-in customer's cart, `false` for the guest cart
   * @returns The cart id and the added item; throws {@link ApiClientError} when the API answers with an error
   */
  async addItem(
    storeRef: string,
    data: AddToCartRequest,
    sessionId: string,
    isAuth: boolean
  ): Promise<{ cart_id: string; item: CartApiItem }> {
    const res = await this.client(isAuth).post<{
      cart_id: string;
      item: CartApiItem;
    }>(`${this.cartPath(isAuth, storeRef)}/items`, data, {
      headers: { "x-session-id": sessionId },
    });
    return unwrap(res);
  }

  /**
   * Changes the quantity of a cart line.
   *
   * @param storeRef - the store's ref or handle
   * @param itemId - the cart line id
   * @param data - the new quantity
   * @param sessionId - the guest cart session id
   * @param isAuth - `true` for the signed-in customer's cart, `false` for the guest cart
   * @returns The cart id and the updated item (`null` when the line was removed); throws {@link ApiClientError} when the API answers with an error
   */
  async updateItem(
    storeRef: string,
    itemId: string,
    data: UpdateCartItemRequest,
    sessionId: string,
    isAuth: boolean
  ): Promise<{ cart_id: string; item: CartApiItem | null }> {
    const res = await this.client(isAuth).put<{
      cart_id: string;
      item: CartApiItem | null;
    }>(`${this.cartPath(isAuth, storeRef)}/items/${itemId}`, data, {
      headers: { "x-session-id": sessionId },
    });
    return unwrap(res);
  }

  /**
   * Removes a line from the cart.
   *
   * @param storeRef - the store's ref or handle
   * @param itemId - the cart line id
   * @param sessionId - the guest cart session id
   * @param isAuth - `true` for the signed-in customer's cart, `false` for the guest cart
   * @returns The cart id and the removed line's id; throws {@link ApiClientError} when the API answers with an error
   */
  async removeItem(
    storeRef: string,
    itemId: string,
    sessionId: string,
    isAuth: boolean
  ): Promise<{ cartId: string; itemId: string }> {
    const res = await this.client(isAuth).delete<{
      cartId: string;
      itemId: string;
    }>(`${this.cartPath(isAuth, storeRef)}/items/${itemId}`, {
      headers: { "x-session-id": sessionId },
    });
    return unwrap(res);
  }

  /**
   * Empties the cart.
   *
   * @param storeRef - the store's ref or handle
   * @param sessionId - the guest cart session id
   * @param isAuth - `true` for the signed-in customer's cart, `false` for the guest cart
   * @returns The cart id; throws {@link ApiClientError} when the API answers with an error
   */
  async clear(
    storeRef: string,
    sessionId: string,
    isAuth: boolean
  ): Promise<{ cart_id: string }> {
    const res = await this.client(isAuth).delete<{ cart_id: string }>(
      this.cartPath(isAuth, storeRef),
      { headers: { "x-session-id": sessionId } }
    );
    return unwrap(res);
  }

  /**
   * Merge the guest cart into the signed-in cart. Resolves to
   * `{ merged: false }` when neither cart exists.
   */
  async merge(
    storeRef: string,
    sessionId: string
  ): Promise<CartApiResponse | { merged: false }> {
    const res = await this.shopperHttp.post<CartApiResponse | { merged: false }>(
      `/storefront/stores/${storeRef}/customers/cart/merge`,
      {},
      { headers: { "x-session-id": sessionId } }
    );
    return unwrap(res);
  }
}
