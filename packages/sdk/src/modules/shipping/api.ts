import type { IHttpClient } from "../../core/types";
import { unwrap } from "../../core/response";
import type {
  LocationAreaQuery,
  LocationAreasResponse,
  ShippingCalculationRequest,
  ShippingOption,
} from "./types";

/**
 * Shipping areas and shipping rates for a store, reached through `sdk.shipping`.
 */
export class ShippingApi {
  constructor(private http: IHttpClient) {}

  /**
   * List administrative areas. Pass `level` for one tier or `parent_code`
   * for one area's children; passing neither returns every area, which for
   * Vietnam is 3,355 rows and about 900 KB. Prefer a filter.
   */
  async listLocationAreas(
    storeRef: string,
    query: LocationAreaQuery = {}
  ): Promise<LocationAreasResponse> {
    const params = new URLSearchParams();
    if (query.level !== undefined) params.set("level", String(query.level));
    if (query.parent_code) params.set("parent_code", query.parent_code);
    const qs = params.toString();

    const res = await this.http.get<LocationAreasResponse>(
      `/public/stores/${storeRef}/shipping/locations${qs ? `?${qs}` : ""}`
    );
    return unwrap(res);
  }

  /**
   * Works out the shipping options and prices for a cart and a destination.
   *
   * @param storeRef - the store's ref or handle
   * @param data - the destination and the cart contents
   * @returns The available shipping options; throws {@link ApiClientError} when the API answers with an error
   */
  async calculate(
    storeRef: string,
    data: ShippingCalculationRequest
  ): Promise<ShippingOption[]> {
    const res = await this.http.post<ShippingOption[]>(
      `/public/stores/${storeRef}/shipping/calculate`,
      data
    );
    return unwrap(res);
  }
}
