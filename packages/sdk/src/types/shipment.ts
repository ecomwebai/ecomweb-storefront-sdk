/**
 * The buyer-facing shipment summary carried on an order, plus its error codes.
 * The API builds it from the carrier booking; this is the wire shape only.
 */
export const SHIPMENT_STATUSES = [
  "booked",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
  "cancelled",
] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

/** One tracking event on a shipment. */
export interface OrderShipmentEvent {
  /** ISO 8601. */
  occurred_at: string;
  /** Carrier status text, ready to show. */
  label: string;
  location: string | null;
}

/** What a buyer sees of their shipment. */
export interface OrderShipmentSummary {
  carrier_name: string | null;
  carrier_logo_url: string | null;
  service_name: string | null;
  tracking_number: string | null;
  track_link: string | null;
  status: ShipmentStatus | null;
  events: OrderShipmentEvent[];
}

/** Error codes the order endpoints return for shipment-related refusals. */
export const ORDER_SHIPMENT_ERROR_CODES = {
  /** Cancelling is refused because a carrier shipment is already in progress. */
  CANCEL_BLOCKED_BY_SHIPMENT: "ORDER_CANCEL_BLOCKED_BY_SHIPMENT",
} as const;
