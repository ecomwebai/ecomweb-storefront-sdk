import "server-only";
import { cookies, headers } from "next/headers";
import { storePreviewTokenFrom } from "./store-preview-cookie";

/**
 * The token this request sends as `X-Store-Preview` (server components
 * only): a preview host's token the middleware stamped, else the store
 * preview cookie, else the theme preview cookie. The layout passes it to
 * `StorefrontKitProvider` while the store is coming soon.
 */
export async function readStorePreviewToken(): Promise<string | null> {
  return storePreviewTokenFrom(await cookies(), { headers: await headers() });
}
