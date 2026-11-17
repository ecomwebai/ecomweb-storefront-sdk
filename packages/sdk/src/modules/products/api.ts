import { stringify } from "../../core/stringify";
import type { IHttpClient } from "../../core/types";
import { unwrapOrNull } from "../../core/response";
import type { ProductDetail, ProductQueryParams } from "./types";

/**
 * Products of a store, reached through `sdk.products`.
 */
export class ProductsApi {
  constructor(private http: IHttpClient) {}

  /**
   * Gets one product by id.
   *
   * @param storeRef - the store's ref or handle
   * @param productId - the product id
   * @param query - optional fields to include
   * @returns The product, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async getById(
    storeRef: string,
    productId: number,
    query?: ProductQueryParams
  ): Promise<ProductDetail | null> {
    const queryString = stringify(query ?? {});
    const res = await this.http.get<ProductDetail>(
      `/storefront/stores/${storeRef}/products/${productId}${queryString ? "?" + queryString : ""}`
    );
    return unwrapOrNull(res);
  }

  /**
   * Gets one product by slug.
   *
   * @param storeRef - the store's ref or handle
   * @param slug - the product slug
   * @param query - optional fields to include
   * @returns The product, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async getBySlug(
    storeRef: string,
    slug: string,
    query?: ProductQueryParams
  ): Promise<ProductDetail | null> {
    const normalizedSlug = slug.normalize("NFC");
    const encodedSlug = encodeURIComponent(normalizedSlug);
    const queryString = stringify(query ?? {});
    const res = await this.http.get<ProductDetail>(
      `/storefront/stores/${storeRef}/products/slug/${encodedSlug}${queryString ? "?" + queryString : ""}`
    );
    return unwrapOrNull(res);
  }
}
