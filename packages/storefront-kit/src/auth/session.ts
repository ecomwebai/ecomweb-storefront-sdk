import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { CurrentIdentity } from "@ecomweb/sdk";
import { authCookiePathFor, readAuthCookies } from "./cookies";
import { clientIpFrom } from "./client-ip";
import { createAuthApi } from "./sdk";
import { storePreviewTokenFrom } from "../stores/store-preview-cookie";

/**
 * The one server-side "who is this request?" read.
 *
 * Wrapped in React `cache()` so several server components in the same render
 * share a single `me()` round trip — `lib/auth/sdk.ts` sends `cache: "no-store"`,
 * so without this every layout and page would issue its own.
 */
export const getServerIdentity = cache(
  async (storeRef: string): Promise<CurrentIdentity | null> => {
    // There is no NextRequest in a server component, but the incoming
    // request's headers are still reachable: they name the cookie path, and
    // the backend rate-limits this call per `storeId:clientIp`, so it has to
    // carry the shopper's address like every other server-side auth call does.
    const requestHeaders = await headers();
    const tokens = readAuthCookies(
      await cookies(),
      storeRef,
      authCookiePathFor({ headers: requestHeaders }, storeRef)
    );
    if (!tokens) return null;

    const me = await createAuthApi(
      storeRef,
      clientIpFrom(requestHeaders),
      storePreviewTokenFrom(await cookies(), { headers: requestHeaders })
    ).me(tokens.access_token);
    return me.success ? (me.data ?? null) : null;
  }
);

/**
 * Whether the request carries a real, logged-in shopper session.
 *
 * An **anonymous** identity (the guest-cart session the backend issues) has a
 * perfectly valid token but is not a logged-in shopper: it has no
 * `customer_id`, no name and no email. Treating it as authenticated admits it
 * to `/account/*` — where every page is empty or errors — and, worse, bounces
 * it away from `/login`, so a guest with a cart could never sign in.
 */
export async function hasCustomerSession(storeRef: string): Promise<boolean> {
  const identity = await getServerIdentity(storeRef);
  return !!identity && !identity.is_anonymous;
}
