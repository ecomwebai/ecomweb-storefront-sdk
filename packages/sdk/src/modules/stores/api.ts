import type { IHttpClient, RequestOptions } from "../../core/types";
import { unwrapOrNull } from "../../core/response";
import type { Store, StoreByDomainInfo, StoreConfigurationInfo } from "./types";

export class StoresApi {
  constructor(private http: IHttpClient) {}

  async getById(
    storeRef: string,
    options?: {
      includeConfig?: boolean;
      includeSettings?: boolean;
      includeEmbeddedScripts?: boolean;
    },
    requestOptions?: RequestOptions
  ): Promise<StoreConfigurationInfo | null> {
    const params = new URLSearchParams();
    if (options?.includeConfig ?? true) params.set("include_config", "1");
    if (options?.includeSettings ?? true) params.set("include_settings", "1");
    if (options?.includeEmbeddedScripts ?? true)
      params.set("include_embedded_scripts", "1");
    const qs = params.toString();
    const url = `/public/stores/${storeRef}${qs ? `?${qs}` : ""}`;
    // Request options (as for getByDomain) reach the client only when given.
    const res = requestOptions
      ? await this.http.get<StoreConfigurationInfo>(url, requestOptions)
      : await this.http.get<StoreConfigurationInfo>(url);
    return unwrapOrNull(res);
  }

  async getBySubdomain(subdomain: string): Promise<Store | null> {
    const res = await this.http.get<Store>(
      `/public/stores/exists/subdomain/${subdomain}`
    );
    return unwrapOrNull(res);
  }

  /**
   * The store `domain` serves. `options` (e.g. an `x-store-preview` header,
   * which opens a coming soon store) is passed to the client only when given.
   */
  async getByDomain(
    domain: string,
    options?: RequestOptions
  ): Promise<StoreByDomainInfo | null> {
    const url = `/public/stores/domain/${domain}`;
    const res = options
      ? await this.http.get<StoreByDomainInfo>(url, options)
      : await this.http.get<StoreByDomainInfo>(url);
    return unwrapOrNull(res);
  }
}
