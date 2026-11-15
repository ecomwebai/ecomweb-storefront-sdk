import type { ShippingOption } from "@ecomweb/sdk";
import { formatPrice, type SupportedCurrency } from "../currency";
import { formatShippingEstimate } from "./messages";

/**
 * A free shipping rate is a VALUE comparison (amount === 0), not a rate
 * type the API tags for us. There is no "FREE" rate_type in the shipping
 * vocabulary on purpose — see @ecomweb/sdk's shipping types.
 */
export function isFreeShippingRate(amount: number): boolean {
  return amount === 0;
}

/**
 * Renders a shipping option's price for display: the free label when the
 * rate is free, the house money format otherwise.
 *
 * `freeLabel` is passed in (see lib/shipping/messages.ts) rather than
 * hardcoded here, so this stays a pure, generic function reachable from a
 * plain vitest spec.
 */
export function formatShippingAmount(
  amount: number,
  freeLabel: string,
  locale: string,
  currency: SupportedCurrency | string
): string {
  return isFreeShippingRate(amount)
    ? freeLabel
    : formatPrice(amount, locale, currency);
}

export interface ShippingOptionDisplay {
  title: string;
  carrierName: string | null;
  carrierLogoUrl: string | null;
  eta: string | null;
}

/** Carrier-provided URLs are untrusted: only http(s) may reach an <img src>. */
function safeHttpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/**
 * What an option row shows: title, carrier (when carrier-quoted) and an ETA.
 * The carrier's own label wins over the fixed-rate day range. The carrier
 * line names the service too: one carrier can offer several at one price.
 */
export function describeShippingOption(
  option: ShippingOption
): ShippingOptionDisplay {
  let eta: string | null = null;
  if (option.estimated_label) {
    eta = option.estimated_label;
  } else if (option.estimated_days_min != null) {
    eta = formatShippingEstimate(
      option.estimated_days_min,
      option.estimated_days_max ?? option.estimated_days_min
    );
  }
  return {
    title: option.display_name,
    carrierName: option.carrier_name
      ? [option.carrier_name, option.carrier_service_name]
          .filter(Boolean)
          .join(" · ")
      : null,
    carrierLogoUrl: safeHttpUrl(option.carrier_logo_url),
    eta,
  };
}
