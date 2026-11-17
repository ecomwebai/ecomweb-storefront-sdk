import { stringify } from "../../core/stringify";
import type { IHttpClient } from "../../core/types";
import { unwrap, unwrapOrNull } from "../../core/response";
import type { Collection, CollectionQueryParams } from "./types";
import type { PaginatedResponse } from "../../types";

/**
 * Product collections of a store, reached through `sdk.collections`.
 */
export class CollectionsApi {
  constructor(private http: IHttpClient) {}

  /**
   * Lists collections, one page at a time.
   *
   * @param storeRef - the store's ref or handle
   * @param params - filters, sorting and paging
   * @returns A page of collections; throws {@link ApiClientError} when the API answers with an error
   */
  async getAllPaginated(
    storeRef: string,
    params?: CollectionQueryParams
  ): Promise<PaginatedResponse<Collection>> {
    const queryString = stringify(params ?? {});
    const res = await this.http.get<PaginatedResponse<Collection>>(
      `/public/stores/${storeRef}/collections${queryString ? "?" + queryString : ""}`
    );
    return unwrap(res);
  }

  /**
   * Lists up to 100 collections in one call.
   *
   * @param storeRef - the store's ref or handle
   * @param ids - limit the result to these collection ids
   * @returns The collections; throws {@link ApiClientError} when the API answers with an error
   */
  async getAll(storeRef: string, ids?: number[]): Promise<Collection[]> {
    const result = await this.getAllPaginated(storeRef, {
      ids,
      limit: ids && ids.length > 0 ? Math.min(ids.length, 100) : 100,
    });
    return result.data;
  }

  /**
   * Gets one collection by slug.
   *
   * @param storeRef - the store's ref or handle
   * @param slug - the collection slug
   * @param query - `include_seo_metadata` adds the SEO fields
   * @returns The collection, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async getBySlug(
    storeRef: string,
    slug: string,
    query?: { include_seo_metadata?: boolean }
  ): Promise<Collection | null> {
    const queryString = query ? stringify(query) : "";
    const res = await this.http.get<Collection>(
      `/public/stores/${storeRef}/collections/slug/${slug}${queryString ? "?" + queryString : ""}`
    );
    return unwrapOrNull(res);
  }
}
