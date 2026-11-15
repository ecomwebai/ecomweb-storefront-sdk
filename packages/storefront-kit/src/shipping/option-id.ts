import type { ShippingOption } from "@ecomweb/sdk";

/**
 * The stable identity of a shipping option. Carrier-backed rates can offer
 * several options under one `rate_id`, so the API sends `option_id`; older
 * APIs don't, and `rate_id` alone is unique there.
 */
export function optionIdOf(option: ShippingOption): string {
  return option.option_id ?? String(option.rate_id);
}
