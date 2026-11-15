// Orders API - Pure API Client Architecture
// Store-based objects pattern - All operations are store-scoped
// All operations use backend API exclusively - no direct database calls
// Supabase used only for auth and storage

// Types (sourced from consolidated interface as single source of truth)
export * from "./types";

// API Clients (store-scoped operations)
export { publicOrdersApi } from "./api-client";

// Shipment tracking view and customer cancel rule
export {
  SHIPMENT_STATUS_LABELS,
  TRACKING_MESSAGES,
  canCustomerCancel,
  deriveShipmentTracking,
  isCarrierShipment,
  isHandedToCarrier,
  shipmentEventLabel,
} from "./shipment-tracking";
export type { ShipmentTrackingView } from "./shipment-tracking";
