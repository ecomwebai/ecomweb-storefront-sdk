import "server-only";
import { headers } from "next/headers";
import { THEME_PREVIEW_HOST_HEADER } from "./preview-host";

/**
 * The theme preview host's slug when this request came in on one (server
 * components only); the middleware sets it, never the client.
 */
export async function readPreviewHostSlug(): Promise<string | null> {
  return (await headers()).get(THEME_PREVIEW_HOST_HEADER) || null;
}
