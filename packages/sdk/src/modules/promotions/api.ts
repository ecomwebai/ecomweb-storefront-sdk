import type { IHttpClient } from "../../core/types";
import { unwrap } from "../../core/response";
import type {
  ValidatePromotionCodeRequest,
  ValidatePromotionCodeResponse,
  PromotionSuggestionsResponse,
} from "./types";

/**
 * Promotion codes and offers of a store, reached through `sdk.promotions`.
 */
export class PromotionsApi {
  /** Client for the public routes, sent with the publishable key. */
  protected publicHttp: IHttpClient;

  constructor(publicHttp: IHttpClient) {
    this.publicHttp = publicHttp;
  }

  /**
   * Lists promotions the shopper could use, optionally for a given cart subtotal.
   *
   * @param storeRef - the store's ref or handle
   * @param subtotal - the cart subtotal in the store's currency
   * @returns The suggested promotions; throws {@link ApiClientError} when the API answers with an error
   */
  async getSuggestions(
    storeRef: string,
    subtotal?: number
  ): Promise<PromotionSuggestionsResponse> {
    const params = new URLSearchParams();
    if (subtotal !== undefined) params.append("subtotal", subtotal.toString());
    const res = await this.publicHttp.get<PromotionSuggestionsResponse>(
      `/storefront/stores/${storeRef}/promotions/suggestions?${params.toString()}`
    );
    return unwrap(res);
  }
}

/**
 * Promotion code checks, reached through `sdk.promotions` on the server and proxied SDKs.
 *
 * Needs a storefront secret key: available on `createEcomwebServerSdk` and `createEcomwebProxiedSdk`, never on `createEcomwebSdk`.
 */
export class PromotionsServerApi extends PromotionsApi {
  constructor(publicHttp: IHttpClient, private privateHttp: IHttpClient) {
    super(publicHttp);
  }

  /**
   * Checks a promotion code against a cart.
   *
   * @param storeRef - the store's ref or handle
   * @param data - the code and the cart details
   * @returns The validation result; throws {@link ApiClientError} when the API answers with an error
   */
  async validate(
    storeRef: string,
    data: ValidatePromotionCodeRequest
  ): Promise<ValidatePromotionCodeResponse> {
    const res = await this.privateHttp.post<ValidatePromotionCodeResponse>(
      `/storefront/stores/${storeRef}/promotions/validate`,
      data
    );
    return unwrap(res);
  }
}
