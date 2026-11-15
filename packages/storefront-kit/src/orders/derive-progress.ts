import type { Order } from "@ecomweb/sdk";

/**
 * The shopper-facing journey. The API tracks four independent status fields;
 * only order_status and shipping_status are meaningful to a customer.
 * fulfillment_status is warehouse vocabulary ("unfulfilled",
 * "return_requested") and is never shown.
 */
export const ORDER_PROGRESS_STEPS = [
  "Đã đặt",
  "Đã xác nhận",
  "Đang chuẩn bị",
  "Đang giao",
  "Đã giao",
] as const;

export type OrderProgress =
  | { kind: "steps"; current_index: number }
  | { kind: "terminal"; label: string; tone: "cancelled" | "on_hold" };

/**
 * Rules are evaluated in order and the first match wins, so a cancelled order
 * shows the terminal state no matter how far shipping had progressed.
 */
export function deriveOrderProgress(order: Order): OrderProgress {
  if (order.order_status === "cancelled") {
    return { kind: "terminal", label: "Đã huỷ", tone: "cancelled" };
  }
  if (order.order_status === "on_hold") {
    return { kind: "terminal", label: "Tạm giữ", tone: "on_hold" };
  }

  switch (order.shipping_status) {
    case "delivered":
      return { kind: "steps", current_index: 4 };
    case "shipped":
    case "in_transit":
    case "out_for_delivery":
      return { kind: "steps", current_index: 3 };
  }

  switch (order.order_status) {
    case "processing":
      return { kind: "steps", current_index: 2 };
    case "confirmed":
      return { kind: "steps", current_index: 1 };
    default:
      return { kind: "steps", current_index: 0 };
  }
}
