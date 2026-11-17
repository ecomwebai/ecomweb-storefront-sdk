import { stringify } from "../../core/stringify";
import type { IHttpClient } from "../../core/types";
import { unwrap } from "../../core/response";
import type {
  ProductSearchParams,
  AutocompleteParams,
  ProductSearchResponse,
  BlogSearchParams,
  BlogSearchResponse,
} from "./types";

/**
 * Search over a store's products and blog posts, reached through `sdk.search`.
 */
export class SearchApi {
  constructor(private http: IHttpClient) {}

  /**
   * Searches products.
   *
   * @param storeRef - the store's ref or handle
   * @param params - the query, filters and paging
   * @returns The matching products; throws {@link ApiClientError} when the API answers with an error
   */
  async searchCatalog(
    storeRef: string,
    params: ProductSearchParams
  ): Promise<ProductSearchResponse> {
    const queryString = stringify(params);
    const res = await this.http.get<ProductSearchResponse>(
      `/storefront/stores/${storeRef}/search/catalog${queryString ? "?" + queryString : ""}`
    );
    return unwrap(res);
  }

  /**
   * Suggests product matches while the shopper is typing.
   *
   * @param storeRef - the store's ref or handle
   * @param params - the partial query and the suggestion limit
   * @returns The suggestions; throws {@link ApiClientError} when the API answers with an error
   */
  async autocompleteCatalog<T>(
    storeRef: string,
    params: AutocompleteParams
  ): Promise<T> {
    const queryString = stringify(params);
    const res = await this.http.get<T>(
      `/storefront/stores/${storeRef}/search/catalog/autocomplete${queryString ? "?" + queryString : ""}`
    );
    return unwrap(res);
  }

  /**
   * Searches published blog posts.
   *
   * @param storeRef - the store's ref or handle
   * @param params - the query and paging
   * @returns The matching posts; throws {@link ApiClientError} when the API answers with an error
   */
  async searchBlog(
    storeRef: string,
    params: BlogSearchParams
  ): Promise<BlogSearchResponse> {
    const queryString = stringify(params);
    const res = await this.http.get<BlogSearchResponse>(
      `/storefront/stores/${storeRef}/search/blog${queryString ? "?" + queryString : ""}`
    );
    return unwrap(res);
  }
}
