/**
 * One administrative area, at any depth, for any country. Replaces the
 * old Province/Ward pair: they differed only by which fields were
 * populated, and `level` now carries that distinction (for Vietnam,
 * 1 = province, 2 = ward).
 *
 * The old `id` was the source JSON object's own key, never a stable
 * identifier. Areas are addressed by `code`.
 */
export interface LocationArea {
  level: number;
  code: string;
  parent_code: string | null;
  name: string;
  name_with_type: string;
  type: string;
  slug: string;
  /** Null for a top-level area: a province has no path through parents. */
  path: string | null;
  path_with_type: string | null;
}

export const LEVEL_PROVINCE = 1;
export const LEVEL_WARD = 2;

export interface LocationAreaQuery {
  /** 1 = province, 2 = ward. */
  level?: number;
  /** Return this area's children, e.g. "11" for Ha Noi's wards. */
  parent_code?: string;
}

export interface LocationAreasResponse {
  country_code: string;
  areas: LocationArea[];
}

export interface ShippingCalculationRequest {
  province_id?: string;
  ward_id?: string;
  province?: string;
  district?: string;
  postal_code?: string;
  subtotal: number;
  currency: string;
  weight_gr: number;
  method?: "standard" | "express" | "pickup" | "cod";
  distance_km?: number;
  tags?: string[];
  /** Opt in to live carrier rates alongside fixed ones. Not defaulted by the SDK. */
  include_carrier_options?: boolean;
}

export const SHIPPING_DELIVERY_TYPES = [
  "STANDARD",
  "EXPRESS",
  "SAME_DAY",
  "ECONOMY",
  "PICKUP",
] as const;
export type ShippingDeliveryType = (typeof SHIPPING_DELIVERY_TYPES)[number];

/** FREE is deliberately absent: a free rate is amount 0. */
export const SHIPPING_RATE_TYPES = ["FIXED", "CARRIER_QUOTE"] as const;
export type ShippingRateType = (typeof SHIPPING_RATE_TYPES)[number];

export const SHIPPING_CONDITION_TYPES = [
  "NONE",
  "ORDER_VALUE",
  "WEIGHT",
] as const;
export type ShippingConditionType = (typeof SHIPPING_CONDITION_TYPES)[number];

export interface ShippingZone {
  id: number;
  code: string;
  name: string;
  provinces: string[];
  wards: string[];
  is_catch_all: boolean;
}

export interface ShippingRate {
  id: number;
  zone_id: number;
  delivery_type: ShippingDeliveryType;
  display_name: string;
  rate_type: ShippingRateType;
  amount: number;
  condition_type: ShippingConditionType;
  min_value: number | null;
  max_value: number | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  is_active: boolean;
  sort_order: number;
}

export interface ShippingOption {
  amount: number;
  currency: string;
  rate_id: number;
  /** `<rate_id>` for fixed, `<rate_id>:<service_id>` for carrier; absent from APIs before carrier rates. */
  option_id?: string;
  delivery_type: ShippingDeliveryType;
  display_name: string;
  estimated_days_min?: number | null;
  estimated_days_max?: number | null;
  /** Set on carrier-quoted options only. */
  carrier_code?: "allingo";
  /** The carrier's own id for the chosen service. */
  carrier_service_id?: string;
  /** Carrier display name, e.g. for a label beside the price. */
  carrier_name?: string;
  /** The carrier's service, e.g. "Giao chuẩn"; tells two options of one carrier apart. */
  carrier_service_name?: string;
  /** Carrier logo, or null when the carrier has none. */
  carrier_logo_url?: string | null;
  /** Human-readable delivery estimate from the carrier, or null. */
  estimated_label?: string | null;
  /** Populated only when the caller asks for debug output. */
  zone_id?: number;
  zone_name?: string;
  shadowed_zones?: Array<{ id: number; name: string; rank: number }>;
}

/** Error codes the shipping endpoints and order creation can return. */
export const SHIPPING_ERROR_CODES = {
  QUOTE_CHANGED: "SHIPPING_QUOTE_CHANGED",
  RATE_UNAVAILABLE: "ORDER_SHIPPING_RATE_UNAVAILABLE",
} as const;

/** `details` of a SHIPPING_QUOTE_CHANGED error: the options now on offer. */
export interface ShippingQuoteChangedDetails {
  options: ShippingOption[];
}
