import { stringify } from "../../core/stringify";
import type { IHttpClient } from "../../core/types";
import { unwrap, unwrapOrNull } from "../../core/response";
import type { PaginatedResponse, Id, WithMetafields } from "../../types";
import type {
  Order,
  OrderWithItems,
  CustomerOrderFilter,
  CreateOrderRequest,
  GuestOrderLookupParams,
} from "./types";

/**
 * Placing orders, and reading them back as a guest or as the signed-in customer, reached through `sdk.orders`.
 */
export class OrdersApi {
  constructor(
    private privateHttp: IHttpClient,
    private shopperHttp: IHttpClient
  ) {}

  /**
   * Look up a guest order. The API answers with the bare order when it
   * matches and `{ message }` (HTTP 200) when it does not; a 404 is treated
   * the same way. Returns null for "not found".
   */
  async lookupGuest(
    storeRef: string,
    params: GuestOrderLookupParams
  ): Promise<OrderWithItems | null> {
    const query = stringify({
      order_code: params.order_code,
      order_number: params.order_number,
      customer_email: params.customer_email,
      customer_phone: params.customer_phone,
    });
    const res = await this.privateHttp.get<OrderWithItems | { message: string }>(
      `/storefront/stores/${storeRef}/orders/lookup?${query}`
    );
    const data = unwrapOrNull(res);
    if (!data || !("id" in data) || data.id == null) return null;
    return data as OrderWithItems;
  }

  /**
   * Places an order.
   *
   * @param storeRef - the store's ref or handle
   * @param data - the order details
   * @param isAuth - `true` to place it as the signed-in customer, `false` as a guest
   * @returns The created order with its items; throws {@link ApiClientError} when the API answers with an error
   */
  async create(
    storeRef: string,
    data: CreateOrderRequest,
    isAuth: boolean
  ): Promise<OrderWithItems> {
    if (isAuth) {
      const res = await this.shopperHttp.post<OrderWithItems>(
        `/storefront/stores/${storeRef}/customers/orders`,
        data
      );
      return unwrap(res);
    }
    const res = await this.privateHttp.post<OrderWithItems>(
      `/storefront/stores/${storeRef}/orders`,
      data
    );
    return unwrap(res);
  }

  /**
   * Lists the signed-in customer's orders, newest first by default.
   *
   * @param storeRef - the store's ref or handle
   * @param params - search, status filter, sorting and paging (`page`, or `limit` and `offset`)
   * @returns A page of orders; throws {@link ApiClientError} when the API answers with an error
   */
  async listCustomerOrders(
    storeRef: string,
    params: Partial<CustomerOrderFilter> & { page?: number } = {}
  ): Promise<PaginatedResponse<Order>> {
    const limit = params.limit ?? 10;
    const page =
      params.page ??
      (params.offset ? Math.floor((params.offset as number) / limit) + 1 : 1);
    const offset = params.offset ?? (page - 1) * limit;
    const query = stringify({
      search: params.search || undefined,
      status: params.status || undefined,
      limit,
      offset,
      include_items: true,
      sort_by: params.sort_by ?? "created_at",
      sort_order: params.sort_order ?? "desc",
    });
    const res = await this.shopperHttp.get<PaginatedResponse<Order>>(
      `/storefront/stores/${storeRef}/customers/orders${query ? `?${query}` : ""}`
    );
    return unwrap(res);
  }

  /**
   * Full detail for one of the authenticated customer's orders. The API
   * verifies ownership and returns 404 — not 403 — for someone else's order.
   */
  async getCustomerOrder(
    storeRef: string,
    orderId: Id
  ): Promise<OrderWithItems & WithMetafields> {
    const res = await this.shopperHttp.get<OrderWithItems & WithMetafields>(
      `/storefront/stores/${storeRef}/customers/orders/${orderId}`
    );
    return unwrap(res);
  }

  /**
   * Customers may only cancel orders that are still pending, confirmed or
   * processing; the API rejects anything else with ORDER_NOT_CANCELLABLE.
   */
  async cancelCustomerOrder(storeRef: string, orderId: Id): Promise<Order> {
    const res = await this.shopperHttp.delete<Order>(
      `/storefront/stores/${storeRef}/customers/orders/${orderId}`
    );
    return unwrap(res);
  }
}
