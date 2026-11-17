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
  /** Client for the public routes, sent with the publishable key. */
  protected publicHttp: IHttpClient;

  constructor(publicHttp: IHttpClient) {
    this.publicHttp = publicHttp;
  }

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

    const res = await this.publicHttp.get<LocationAreasResponse>(
      `/storefront/stores/${storeRef}/shipping/locations${qs ? `?${qs}` : ""}`
    );
    return unwrap(res);
  }
}

/**
 * Shipping rates for a cart, reached through `sdk.shipping` on the server and proxied SDKs.
 *
 * Needs a storefront secret key: available on `createEcomwebServerSdk` and `createEcomwebProxiedSdk`, never on `createEcomwebSdk`.
 */
export class ShippingServerApi extends ShippingApi {
  constructor(publicHttp: IHttpClient, private privateHttp: IHttpClient) {
    super(publicHttp);
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
    const res = await this.privateHttp.post<ShippingOption[]>(
      `/storefront/stores/${storeRef}/shipping/calculate`,
      data
    );
    return unwrap(res);
  }
}
