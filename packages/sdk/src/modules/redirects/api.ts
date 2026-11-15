import type { IHttpClient, RequestOptions } from "../../core/types";
import { unwrapOrNull } from "../../core/response";
import type { UrlRedirect } from "./types";

export class RedirectsApi {
  constructor(private http: IHttpClient) {}

  /** `options` (request options) are passed to the client only when given. */
  async lookup(
    storeRef: string,
    path: string,
    options?: RequestOptions
  ): Promise<UrlRedirect | null> {
    const params = new URLSearchParams();
    params.set("path", path);
    const url = `/public/stores/${storeRef}/url-redirects/lookup?${params.toString()}`;
    const res = options
      ? await this.http.get<{ data: UrlRedirect | null }>(url, options)
      : await this.http.get<{ data: UrlRedirect | null }>(url);
    const result = unwrapOrNull(res);
    return result?.data ?? null;
  }
}
