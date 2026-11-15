import "server-only";
import { cookies, headers } from "next/headers";
import { isHostMappedRequest } from "../auth/cookies";
import { THEME_PREVIEW_COOKIE, themePreviewCookieName } from "./preview-cookie";

/** The open theme preview's token, if any (server components only). */
export async function readThemePreviewToken(): Promise<string | null> {
  // Host-mapped requests keep the cookie at `/` (authCookiePath), the one
  // path whose name differs; on the shared host it is path-scoped and bare.
  const name = isHostMappedRequest({ headers: await headers() })
    ? themePreviewCookieName("/")
    : THEME_PREVIEW_COOKIE;
  return (await cookies()).get(name)?.value || null;
}
