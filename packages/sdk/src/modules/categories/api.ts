import { stringify } from "../../core/stringify";
import type { IHttpClient } from "../../core/types";
import { unwrap, unwrapOrNull } from "../../core/response";
import type { Category, CategoryQueryParams } from "./types";
import type { PaginatedResponse } from "../../types";

/**
 * Product categories of a store, reached through `sdk.categories`.
 */
export class CategoriesApi {
  constructor(private http: IHttpClient) {}

  /**
   * Lists categories, one page at a time.
   *
   * @param storeRef - the store's ref or handle
   * @param params - filters, sorting and paging
   * @returns A page of categories; throws {@link ApiClientError} when the API answers with an error
   */
  async getAllPaginated(
    storeRef: string,
    params?: CategoryQueryParams
  ): Promise<PaginatedResponse<Category>> {
    const queryString = stringify(params ?? {});
    const res = await this.http.get<PaginatedResponse<Category>>(
      `/storefront/stores/${storeRef}/categories${queryString ? "?" + queryString : ""}`
    );
    return unwrap(res);
  }

  /**
   * Lists up to 1,000 categories in one call.
   *
   * @param storeRef - the store's ref or handle
   * @param activeOnly - `true` (the default) returns only active categories
   * @returns The categories; throws {@link ApiClientError} when the API answers with an error
   */
  async getAll(storeRef: string, activeOnly = true): Promise<Category[]> {
    const result = await this.getAllPaginated(storeRef, {
      is_active: activeOnly,
      limit: 1000,
    });
    return result.data;
  }

  /**
   * Gets one category by id.
   *
   * @param storeRef - the store's ref or handle
   * @param categoryId - the category id
   * @returns The category, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async getById(
    storeRef: string,
    categoryId: number
  ): Promise<Category | null> {
    const res = await this.http.get<Category>(
      `/storefront/stores/${storeRef}/categories/${categoryId}`
    );
    return unwrapOrNull(res);
  }

  /**
   * Gets one category by slug.
   *
   * @param storeRef - the store's ref or handle
   * @param slug - the category slug
   * @returns The category, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async getBySlug(storeRef: string, slug: string): Promise<Category | null> {
    const res = await this.http.get<Category>(
      `/storefront/stores/${storeRef}/categories/${encodeURIComponent(slug)}`
    );
    return unwrapOrNull(res);
  }
}
