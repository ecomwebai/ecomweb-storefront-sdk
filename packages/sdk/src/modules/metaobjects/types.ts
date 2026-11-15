import type { StorefrontMetaobjectEntry } from "../../types/metafields";

export interface MetaobjectListParams {
  /** Equality filters on the definition's filter keys (spec §6.4). */
  filter?: Record<string, string | number | boolean>;
  cursor?: string;
  /** At most 50. */
  limit?: number;
  /** Send the customer session, for definitions with customer access only. */
  as_customer?: boolean;
}

export interface MetaobjectListResult {
  items: StorefrontMetaobjectEntry[];
  next_cursor: string | null;
}
