import type { IHttpClient } from "../../core/types";
import { unwrapOrNull } from "../../core/response";
import type { PublishedStoreTheme } from "../stores/types";

/** Refusals that mean "no preview": bad, expired or foreign token, or previews off. */
const NO_PREVIEW = [400, 401, 403, 404, 503];

export class ThemesApi {
  constructor(private http: IHttpClient) {}

  /** The store theme a dashboard preview link points to; null if refused. */
  async getPreview(
    storeRef: string,
    token: string
  ): Promise<PublishedStoreTheme | null> {
    const res = await this.http.get<PublishedStoreTheme>(
      `/public/stores/${storeRef}/theme-preview?token=${encodeURIComponent(token)}`
    );
    return unwrapOrNull(res, NO_PREVIEW);
  }

  /** The theme on a preview host, p-<slug>, with its saved values. */
  async getPreviewBySlug(
    storeRef: string,
    slug: string
  ): Promise<PublishedStoreTheme | null> {
    const res = await this.http.get<PublishedStoreTheme>(
      `/public/stores/${storeRef}/theme-preview?slug=${encodeURIComponent(slug)}`
    );
    return unwrapOrNull(res, NO_PREVIEW);
  }
}
