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
  constructor(private http: IHttpClient) {}

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
    const res = await this.http.post<ValidatePromotionCodeResponse>(
      `/public/stores/${storeRef}/promotions/validate`,
      data
    );
    return unwrap(res);
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
    const res = await this.http.get<PromotionSuggestionsResponse>(
      `/public/stores/${storeRef}/promotions/suggestions?${params.toString()}`
    );
    return unwrap(res);
  }
}
