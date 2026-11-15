import { describe, expect, it } from "vitest";
import type { Order } from "@ecomweb/sdk";
import { deriveOrderProgress, ORDER_PROGRESS_STEPS } from "./derive-progress";

function order(patch: Partial<Order>): Order {
  return {
    order_status: "pending",
    fulfillment_status: "unfulfilled",
    shipping_status: "not_shipped",
    payment_status: "pending",
    ...patch,
  } as Order;
}

describe("deriveOrderProgress", () => {
  it("exposes five shopper-facing steps", () => {
    expect(ORDER_PROGRESS_STEPS).toHaveLength(5);
  });

  it.each([
    ["pending", 0],
    ["confirmed", 1],
    ["processing", 2],
  ])("maps order_status %s to step index %i", (order_status, index) => {
    const result = deriveOrderProgress(order({ order_status } as Partial<Order>));
    expect(result).toEqual({ kind: "steps", current_index: index });
  });

  it.each(["shipped", "in_transit", "out_for_delivery"])(
    "maps shipping_status %s to Đang giao",
    (shipping_status) => {
      const result = deriveOrderProgress(
        order({ order_status: "processing", shipping_status } as Partial<Order>),
      );
      expect(result).toEqual({ kind: "steps", current_index: 3 });
    },
  );

  it("maps delivered to the final step", () => {
    const result = deriveOrderProgress(
      order({ order_status: "completed", shipping_status: "delivered" } as Partial<Order>),
    );
    expect(result).toEqual({ kind: "steps", current_index: 4 });
  });

  it("shows the terminal state for a cancelled order regardless of shipping", () => {
    const result = deriveOrderProgress(
      order({ order_status: "cancelled", shipping_status: "delivered" } as Partial<Order>),
    );
    expect(result).toEqual({
      kind: "terminal",
      label: "Đã huỷ",
      tone: "cancelled",
    });
  });

  it("shows the terminal state for an on-hold order", () => {
    const result = deriveOrderProgress(
      order({ order_status: "on_hold" } as Partial<Order>),
    );
    expect(result).toEqual({
      kind: "terminal",
      label: "Tạm giữ",
      tone: "on_hold",
    });
  });

  it("falls back to the first step for an unknown status", () => {
    const result = deriveOrderProgress(
      order({ order_status: "something_new" } as unknown as Partial<Order>),
    );
    expect(result).toEqual({ kind: "steps", current_index: 0 });
  });
});
