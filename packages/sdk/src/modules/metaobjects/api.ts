import type { IHttpClient } from "../../core/types";
import { unwrapOrNull } from "../../core/response";
import type { StorefrontMetaobjectEntry } from "../../types/metafields";
import type { MetaobjectListParams, MetaobjectListResult } from "./types";

const EMPTY: MetaobjectListResult = { items: [], next_cursor: null };

/**
 * Custom structured content (metaobject entries) a store publishes, reached through `sdk.metaobjects`.
 */
export class MetaobjectsApi {
  constructor(
    private publicHttp: IHttpClient,
    private authHttp: IHttpClient
  ) {}

  /**
   * Active entries of a metaobject type. A type that is unknown or hidden
   * from this reader lists as empty: the API answers 404 for both, the same
   * as a missing type, so it never reveals which types exist.
   */
  async list(
    storeRef: string,
    type: string,
    params: MetaobjectListParams = {}
  ): Promise<MetaobjectListResult> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params.filter ?? {})) {
      query.append(`filter[${key}]`, String(value));
    }
    if (params.cursor) query.set("cursor", params.cursor);
    if (params.limit !== undefined) query.set("limit", String(params.limit));
    const search = query.toString();
    const http = params.as_customer ? this.authHttp : this.publicHttp;
    const res = await http.get<MetaobjectListResult>(
      `/storefront/stores/${storeRef}/metaobjects/${encodeURIComponent(type)}${search ? `?${search}` : ""}`
    );
    return unwrapOrNull(res, [404]) ?? EMPTY;
  }

  /** One active entry by handle; null when it, or its type, is missing or hidden. */
  async get(
    storeRef: string,
    type: string,
    handle: string,
    options: { as_customer?: boolean } = {}
  ): Promise<StorefrontMetaobjectEntry | null> {
    const http = options.as_customer ? this.authHttp : this.publicHttp;
    const res = await http.get<StorefrontMetaobjectEntry>(
      `/storefront/stores/${storeRef}/metaobjects/${encodeURIComponent(type)}/${encodeURIComponent(handle)}`
    );
    return unwrapOrNull(res, [404]);
  }
}
