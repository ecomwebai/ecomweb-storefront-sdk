import type { IHttpClient } from "../../core/types";
import { unwrap } from "../../core/response";
import type { PaymentMethod } from "./types";

/**
 * The payment methods a store accepts, reached through `sdk.paymentMethods`.
 */
export class PaymentMethodsApi {
  constructor(private http: IHttpClient) {}

  /**
   * Lists the payment methods the store has turned on.
   *
   * @param storeRef - the store's ref or handle
   * @returns The enabled payment methods; throws {@link ApiClientError} when the API answers with an error
   */
  async getEnabled(storeRef: string): Promise<PaymentMethod[]> {
    const res = await this.http.get<PaymentMethod[]>(
      `/public/stores/${storeRef}/payment-methods`
    );
    return unwrap(res);
  }
}
