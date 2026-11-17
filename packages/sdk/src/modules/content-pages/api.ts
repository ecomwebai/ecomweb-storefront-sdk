import { stringify } from "../../core/stringify";
import type { IHttpClient } from "../../core/types";
import { unwrap } from "../../core/response";
import type { PaginatedResponse } from "../../types";
import type { ContentPage } from "./types";

/**
 * Static content pages of a store, such as About or Shipping policy, reached through `sdk.contentPages`.
 */
export class ContentPagesApi {
  constructor(private http: IHttpClient) {}

  /**
   * Lists the published content pages.
   *
   * @param storeRef - the store's ref or handle
   * @returns A page of content pages; throws {@link ApiClientError} when the API answers with an error
   */
  async getPublished(
    storeRef: string
  ): Promise<PaginatedResponse<ContentPage>> {
    const res = await this.http.get<PaginatedResponse<ContentPage>>(
      `/storefront/stores/${storeRef}/content-pages`
    );
    return unwrap(res);
  }

  /**
   * Gets one published content page by slug.
   *
   * @param storeRef - the store's ref or handle
   * @param slug - the page slug
   * @param query - `include_seo_metadata` adds the SEO fields
   * @returns The page; throws {@link ApiClientError} when the API answers with an error
   */
  async getBySlug(
    storeRef: string,
    slug: string,
    query?: { include_seo_metadata?: boolean }
  ): Promise<ContentPage> {
    const queryString = query ? stringify(query) : "";
    const res = await this.http.get<ContentPage>(
      `/storefront/stores/${storeRef}/content-pages/${encodeURIComponent(slug)}${queryString ? "?" + queryString : ""}`
    );
    return unwrap(res);
  }
}
