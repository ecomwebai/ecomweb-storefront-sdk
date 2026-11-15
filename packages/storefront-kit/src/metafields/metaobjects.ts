import type {
  MetaobjectListParams,
  MetaobjectListResult,
  StorefrontMetaobjectEntry,
} from "@ecomweb/sdk";
import { createStoreSdk, sdk } from "../sdk";

/**
 * The public sdk, or, for a definition with customer access, the store-scoped
 * one whose authenticated calls go through the same-origin session proxy.
 * That proxy is a relative URL, so `as_customer` works in client components
 * only.
 */
function clientFor(storeRef: string, asCustomer: boolean | undefined) {
  if (asCustomer && typeof window === "undefined") {
    throw new Error(
      "as_customer reads need the browser: call getMetaobjects with as_customer from a client component"
    );
  }
  return asCustomer ? createStoreSdk(storeRef) : sdk;
}

/**
 * Active entries of a metaobject type, e.g.
 * `getMetaobjects(storeRef, "feedbacks", { filter: { rating: 5 }, limit: 10 })`.
 *
 * `filter` accepts only the definition's filter keys, equality only; `limit`
 * is at most 50. A type that does not exist, or has no storefront access,
 * lists as empty: the API answers both the same way.
 */
export async function getMetaobjects(
  storeRef: string,
  type: string,
  options: MetaobjectListParams = {}
): Promise<MetaobjectListResult> {
  return clientFor(storeRef, options.as_customer).metaobjects.list(
    storeRef,
    type,
    options
  );
}

/** One active entry by handle; null when it, or its type, is missing or hidden. */
export async function getMetaobject(
  storeRef: string,
  type: string,
  handle: string,
  options: { as_customer?: boolean } = {}
): Promise<StorefrontMetaobjectEntry | null> {
  return clientFor(storeRef, options.as_customer).metaobjects.get(
    storeRef,
    type,
    handle,
    options
  );
}
