import type { Order, OrderShipmentSummary, ShipmentStatus } from "@ecomweb/sdk";

/** The API's SHIPMENT_STATUS_LABEL_VI, copied exactly so badge and events agree. */
export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  booked: "Đã tạo vận đơn",
  picked_up: "Đã lấy hàng",
  in_transit: "Đang vận chuyển",
  out_for_delivery: "Đang giao hàng",
  delivered: "Đã giao",
  failed: "Giao hàng thất bại",
  returned: "Đã hoàn hàng",
  cancelled: "Đã hủy",
};

export const TRACKING_MESSAGES = {
  title: "Vận chuyển",
  trackingNumber: "Mã vận đơn",
  trackLink: "Theo dõi đơn hàng",
  handedToCarrier: "Đơn đã được giao cho hãng vận chuyển",
  noEvents: "Chưa có cập nhật từ hãng vận chuyển",
  eventFallback: "Cập nhật vận chuyển",
} as const;

export interface ShipmentTrackingView {
  carrierName: string | null;
  carrierLogoUrl: string | null;
  serviceName: string | null;
  trackingNumber: string | null;
  trackLink: string | null;
  statusLabel: string | null;
  events: OrderShipmentSummary["events"];
}

const CANCELLABLE_STATUSES = ["pending", "confirmed", "processing"];
const ENDED_STATUSES: string[] = ["cancelled", "failed", "returned"];

function httpLinkOrNull(link: string | null | undefined): string | null {
  return link && /^https?:\/\//i.test(link.trim()) ? link.trim() : null;
}

function labelOrNull(status: string | null | undefined): string | null {
  if (!status) return null;
  return Object.prototype.hasOwnProperty.call(SHIPMENT_STATUS_LABELS, status)
    ? SHIPMENT_STATUS_LABELS[status as ShipmentStatus]
    : null;
}

export function deriveShipmentTracking(
  order: Order,
): ShipmentTrackingView | null {
  const shipment = order.shipment;
  // An explicit `shipment: null` means the API decided there is nothing to show
  // (e.g. a cancelled waybill); the order's own fields are only a fallback for
  // an older API that does not send `shipment` at all.
  if (shipment === null) return null;
  if (shipment) {
    return {
      carrierName: shipment.carrier_name ?? null,
      carrierLogoUrl: httpLinkOrNull(shipment.carrier_logo_url),
      serviceName: shipment.service_name ?? null,
      trackingNumber: shipment.tracking_number ?? null,
      trackLink: httpLinkOrNull(shipment.track_link),
      statusLabel: labelOrNull(shipment.status),
      events: shipment.events ?? [],
    };
  }
  if (order.shipping_carrier || order.tracking_number) {
    return {
      carrierName: order.shipping_carrier ?? null,
      carrierLogoUrl: null,
      serviceName: null,
      trackingNumber: order.tracking_number ?? null,
      trackLink: null,
      statusLabel: null,
      events: [],
    };
  }
  return null;
}

export function canCustomerCancel(order: Order): boolean {
  if (typeof order.can_cancel === "boolean") return order.can_cancel;
  return CANCELLABLE_STATUSES.includes(order.order_status);
}

export function isHandedToCarrier(order: Order): boolean {
  const status = order.shipment?.status;
  return !!status && !ENDED_STATUSES.includes(status);
}

/**
 * True only for a carrier-booked shipment. The API also sends `order.shipment`
 * for a manual shipment (carrier and tracking number typed by the merchant),
 * with `status: null` and no events; that one has no carrier timeline to show.
 */
export function isCarrierShipment(order: Order): boolean {
  return order.shipment?.status != null;
}

/**
 * The text of one tracking event. A blank label falls back to the event's own
 * status label when it carries a known one, else to neutral copy -- never the
 * shipment's current status, which is not what that event reported.
 */
export function shipmentEventLabel(event: {
  label?: string | null;
  status?: string | null;
}): string {
  const label = event.label?.trim();
  if (label) return label;
  return labelOrNull(event.status) ?? TRACKING_MESSAGES.eventFallback;
}
