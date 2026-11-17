import type { IHttpClient } from "../../core/types";
import { unwrapOrNull } from "../../core/response";
import type { Address, CreateAddressDto, UpdateAddressDto } from "./types";

/**
 * Saved delivery addresses of the signed-in customer, reached through `sdk.addresses`.
 */
export class AddressesApi {
  constructor(private http: IHttpClient) {}

  /**
   * Lists the signed-in customer's saved addresses.
   *
   * @param storeRef - the store's ref or handle
   * @returns The addresses, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async list(storeRef: string): Promise<Address[] | null> {
    const res = await this.http.get<Address[]>(
      `/storefront/stores/${storeRef}/customers/address`
    );
    return unwrapOrNull(res);
  }

  /**
   * Gets one of the signed-in customer's saved addresses.
   *
   * @param storeRef - the store's ref or handle
   * @param addressId - the address id
   * @returns The address, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async getById(storeRef: string, addressId: number): Promise<Address | null> {
    const res = await this.http.get<Address>(
      `/storefront/stores/${storeRef}/customers/address/${addressId}`
    );
    return unwrapOrNull(res);
  }

  /**
   * Saves a new address for the signed-in customer.
   *
   * @param storeRef - the store's ref or handle
   * @param data - the address fields
   * @returns The created address, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async create(
    storeRef: string,
    data: CreateAddressDto
  ): Promise<Address | null> {
    const res = await this.http.post<Address>(
      `/storefront/stores/${storeRef}/customers/address`,
      data
    );
    return unwrapOrNull(res);
  }

  /**
   * Updates one of the signed-in customer's saved addresses.
   *
   * @param storeRef - the store's ref or handle
   * @param addressId - the address id
   * @param data - the fields to change
   * @returns The updated address, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async update(
    storeRef: string,
    addressId: number,
    data: UpdateAddressDto
  ): Promise<Address | null> {
    const res = await this.http.patch<Address>(
      `/storefront/stores/${storeRef}/customers/address/${addressId}`,
      data
    );
    return unwrapOrNull(res);
  }

  /**
   * Deletes one of the signed-in customer's saved addresses.
   *
   * @param storeRef - the store's ref or handle
   * @param addressId - the address id
   * @returns `true` when the API accepted the deletion, `false` otherwise; it does not throw
   */
  async delete(storeRef: string, addressId: number): Promise<boolean> {
    const res = await this.http.delete(
      `/storefront/stores/${storeRef}/customers/address/${addressId}`
    );
    return res.success;
  }

  /**
   * Makes a saved address the customer's default.
   *
   * @param storeRef - the store's ref or handle
   * @param addressId - the address id
   * @returns The updated address, or `null` when it is not found; throws {@link ApiClientError} on any other API error
   */
  async setDefault(
    storeRef: string,
    addressId: number
  ): Promise<Address | null> {
    const res = await this.http.patch<Address>(
      `/storefront/stores/${storeRef}/customers/address/${addressId}/set-default`
    );
    return unwrapOrNull(res);
  }
}
