import { describe, expect, it } from "vitest";
import type { Order } from "./order";
import { ORDER_SHIPMENT_ERROR_CODES, SHIPMENT_STATUSES } from "./shipment";

describe("order shipment", () => {
  it("an order carries the buyer-facing shipment", () => {
    const order: Pick<Order, "shipment" | "can_cancel" | "shipping_carrier"> = {
      shipping_carrier: "GHN",
      shipment: {
        carrier_name: "GHN",
        carrier_logo_url: null,
        service_name: null,
        tracking_number: null,
        track_link: null,
        status: "in_transit",
        events: [
          {
            occurred_at: "2026-10-20T03:00:00Z",
            label: "Đang vận chuyển",
            location: "Q1",
          },
        ],
      },
      can_cancel: false,
    };
    expect(order.shipment?.events).toHaveLength(1);
    expect(SHIPMENT_STATUSES).toHaveLength(8);
    expect(SHIPMENT_STATUSES).toContain("out_for_delivery");
    expect(ORDER_SHIPMENT_ERROR_CODES.CANCEL_BLOCKED_BY_SHIPMENT).toBe(
      "ORDER_CANCEL_BLOCKED_BY_SHIPMENT",
    );
  });
});
