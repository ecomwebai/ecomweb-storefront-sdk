import type { IHttpClient, ApiResponse } from "../../core/types";
import { unwrap } from "../../core/response";
import type { MetafieldWrite, StorefrontMetafields } from "../../types/metafields";
import type { Customer, UpsertCustomerForAuthPayload } from "./types";

export class CustomersApi {
  constructor(private http: IHttpClient) {}

  async upsertForAuth(
    storeRef: string,
    payload: UpsertCustomerForAuthPayload
  ): Promise<ApiResponse<Customer>> {
    return this.http.post<Customer>(
      `/stores/${storeRef}/customers/auth/upsert`,
      payload
    );
  }

  /** The signed-in customer's metafields with customer access (spec §6.6). */
  async getMetafields(storeRef: string): Promise<StorefrontMetafields> {
    const res = await this.http.get<StorefrontMetafields>(
      `/tenant/stores/${storeRef}/customers/metafields`
    );
    return unwrap(res);
  }

  /**
   * Writes read_write metafields; `value: null` clears one. Throws
   * METAFIELD_VALUE_INVALID (details.errors[] by path) or METAFIELD_NOT_WRITABLE.
   */
  async updateMetafields(
    storeRef: string,
    values: MetafieldWrite[]
  ): Promise<StorefrontMetafields> {
    const res = await this.http.put<StorefrontMetafields>(
      `/tenant/stores/${storeRef}/customers/metafields`,
      { values }
    );
    return unwrap(res);
  }
}
