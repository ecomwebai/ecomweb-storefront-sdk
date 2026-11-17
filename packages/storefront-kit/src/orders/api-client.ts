import { createStoreSdk } from "../sdk";
import type { CreateOrderRequest, Order, OrderWithItems } from "@ecomweb/sdk";

export const publicOrdersApi = {
  async getPublicOrderStatus(
    storeRef: string,
    orderNumber: number,
    contactInfo: { email?: string; phone?: string }
  ): Promise<Order | null> {
    const result = await createStoreSdk(storeRef).orders.lookupGuest(storeRef, {
      order_number: orderNumber,
      customer_email: contactInfo.email,
      customer_phone: contactInfo.phone,
    });
    return result;
  },

  /**
   * `isAuth` comes from the caller's auth context — this module is not a
   * component and must not read context or an httpOnly cookie itself.
   *
   * When true the SDK posts to `/storefront/stores/:ref/customers/orders`, which
   * derives BOTH `customer_id` (ResolveCustomerInterceptor) and `user_id`
   * (JWT) server-side; the payload carries neither, and `CreateOrderDto` has no
   * such fields to carry them in. The request reaches that guarded route
   * through the same-origin proxy, which attaches the bearer token.
   */
  async createStoreOrder(
    storeRef: string,
    data: Omit<CreateOrderRequest, "store_id">,
    isAuth: boolean
  ): Promise<OrderWithItems> {
    return createStoreSdk(storeRef).orders.create(
      storeRef,
      data as CreateOrderRequest,
      isAuth
    );
  },
};

export type { CreateOrderRequest, CreateOrderItemRequest } from "@ecomweb/sdk";
