import type { IHttpClient } from "../../core/types";
import { unwrapOrNull } from "../../core/response";
import type { StoreMenu } from "./types";

/**
 * Navigation menus of a store, reached through `sdk.menus`.
 */
export class MenusApi {
  constructor(private http: IHttpClient) {}

  /**
   * Gets a navigation menu by its ref.
   *
   * @param storeRef - the store's ref or handle
   * @param ref - the menu ref
   * @param includeItems - `true` (the default) includes the menu items
   * @returns The menu, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async getByRef(
    storeRef: string,
    ref: string,
    includeItems = true
  ): Promise<StoreMenu | null> {
    const query = includeItems ? "?include_items=true" : "";
    const res = await this.http.get<StoreMenu>(
      `/public/stores/${storeRef}/menus/ref/${encodeURIComponent(ref)}${query}`
    );
    return unwrapOrNull(res);
  }
}
