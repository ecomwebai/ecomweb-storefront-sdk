import { describe, expect, it } from "vitest";
import type { Order, OrderShipmentSummary } from "@ecomweb/sdk";
import {
  SHIPMENT_STATUS_LABELS,
  canCustomerCancel,
  deriveShipmentTracking,
  isCarrierShipment,
  isHandedToCarrier,
  shipmentEventLabel,
} from "./shipment-tracking";

function order(patch: Partial<Order>): Order {
  return { order_status: "pending", ...patch } as Order;
}

function shipment(patch: Partial<OrderShipmentSummary>): OrderShipmentSummary {
  return {
    carrier_name: "AllinGo",
    carrier_logo_url: "https://cdn.example/logo.png",
    service_name: "Standard",
    tracking_number: "AG1",
    track_link: "https://track.example/AG1",
    status: "in_transit",
    events: [],
    ...patch,
  };
}

describe("deriveShipmentTracking", () => {
  it("maps an AllinGo shipment to the tracking view", () => {
    const events = [
      { occurred_at: "2026-10-21T02:00:00Z", label: "b", location: null },
      { occurred_at: "2026-10-21T01:00:00Z", label: "a", location: "HN" },
    ];
    const view = deriveShipmentTracking(order({ shipment: shipment({ events }) }));
    expect(view).toEqual({
      carrierName: "AllinGo",
      carrierLogoUrl: "https://cdn.example/logo.png",
      serviceName: "Standard",
      trackingNumber: "AG1",
      trackLink: "https://track.example/AG1",
      statusLabel: "Đang vận chuyển",
      events,
    });
  });

  it("uses the API's status labels", () => {
    expect(SHIPMENT_STATUS_LABELS).toEqual({
      booked: "Đã tạo vận đơn",
      picked_up: "Đã lấy hàng",
      in_transit: "Đang vận chuyển",
      out_for_delivery: "Đang giao hàng",
      delivered: "Đã giao",
      failed: "Giao hàng thất bại",
      returned: "Đã hoàn hàng",
      cancelled: "Đã hủy",
    });
  });

  it("a manual shipment shows carrier and tracking number only", () => {
    const view = deriveShipmentTracking(
      order({ shipping_carrier: "Viettel Post", tracking_number: "VT123" }),
    );
    expect(view).toMatchObject({
      carrierName: "Viettel Post",
      trackingNumber: "VT123",
      statusLabel: null,
      events: [],
    });
  });

  it("nothing to show is null", () => {
    expect(deriveShipmentTracking(order({}))).toBeNull();
  });

  it("an unknown status or a non-http link is dropped, not shown", () => {
    const view = deriveShipmentTracking(
      order({
        shipment: shipment({
          status: "lost" as never,
          track_link: "javascript:alert(1)",
        }),
      }),
    );
    expect(view?.statusLabel).toBeNull();
    expect(view?.trackLink).toBeNull();
  });
});

describe("canCustomerCancel", () => {
  it("can_cancel from the API wins", () => {
    expect(
      canCustomerCancel(order({ can_cancel: false, order_status: "confirmed" })),
    ).toBe(false);
  });

  it("an API without can_cancel keeps today's rule", () => {
    expect(canCustomerCancel(order({ order_status: "processing" }))).toBe(true);
    expect(canCustomerCancel(order({ order_status: "shipped" } as never))).toBe(
      false,
    );
  });
});

describe("isHandedToCarrier", () => {
  it("ignores ended shipments", () => {
    expect(isHandedToCarrier(order({}))).toBe(false);
    expect(isHandedToCarrier(order({ shipment: shipment({ status: null }) }))).toBe(false);
    for (const status of ["cancelled", "failed", "returned"] as const) {
      expect(isHandedToCarrier(order({ shipment: shipment({ status }) }))).toBe(false);
    }
    expect(isHandedToCarrier(order({ shipment: shipment({ status: "booked" }) }))).toBe(true);
  });
});

describe("manual shipment as the API sends it", () => {
  const manual = order({
    shipment: shipment({
      carrier_name: "GHTK",
      carrier_logo_url: null,
      service_name: null,
      tracking_number: "GH123",
      track_link: null,
      status: null,
      events: [],
    }),
  });

  it("derives carrier and tracking number with no status label", () => {
    expect(deriveShipmentTracking(manual)).toEqual({
      carrierName: "GHTK",
      carrierLogoUrl: null,
      serviceName: null,
      trackingNumber: "GH123",
      trackLink: null,
      statusLabel: null,
      events: [],
    });
  });

  it("is not a carrier shipment", () => {
    expect(isCarrierShipment(manual)).toBe(false);
  });

  it("an AllinGo shipment is", () => {
    expect(isCarrierShipment(order({ shipment: shipment({}) }))).toBe(true);
    expect(isCarrierShipment(order({}))).toBe(false);
  });
});

describe("shipmentEventLabel", () => {
  it("uses the label", () => {
    expect(shipmentEventLabel({ label: " Đã lấy " })).toBe("Đã lấy");
  });
  it("falls back to the event's own status label", () => {
    expect(shipmentEventLabel({ label: " ", status: "delivered" })).toBe(
      "Đã giao"
    );
  });
  it("falls back to neutral text without a status", () => {
    expect(shipmentEventLabel({ label: "" })).toBe("Cập nhật vận chuyển");
    expect(shipmentEventLabel({ label: "", status: "weird" })).toBe(
      "Cập nhật vận chuyển"
    );
  });
});

describe("deriveShipmentTracking fallback", () => {
  it("returns null when the API sends shipment: null", () => {
    expect(
      deriveShipmentTracking(
        order({ shipment: null, shipping_carrier: "GHTK", tracking_number: "X" })
      )
    ).toBeNull();
  });
  it("falls back to the order fields when shipment is undefined", () => {
    expect(
      deriveShipmentTracking(
        order({ shipping_carrier: "GHTK", tracking_number: "X" })
      )
    ).toMatchObject({ carrierName: "GHTK", trackingNumber: "X", events: [] });
  });
});
