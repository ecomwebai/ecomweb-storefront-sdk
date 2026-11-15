import { publicOrdersApi } from "../orders";

export interface ShippingInfo {
  fullName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  ward: string;
  notes: string;
}

export interface PaymentInfo {
  method: "cod" | "bank" | "momo" | "zalopay";
}

export type CreatedOrder = Awaited<
  ReturnType<typeof publicOrdersApi.createStoreOrder>
>;

export interface OrderSuccessInfo {
  order: CreatedOrder;
  email?: string;
  phone?: string;
}
