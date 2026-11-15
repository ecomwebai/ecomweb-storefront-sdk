// Recovering a store's ref from a platform-host URL.
//
// Lives in lib/ rather than beside the hook that uses it for a practical
// reason: vitest.config.ts collects only "lib/**" spec files (plus root-level
// ones), so a spec anywhere under hooks/ would never run — it would pass by
// never executing.

/**
 * The `<ref>` in `/store/<ref>/...`, or null anywhere else.
 *
 * Used only as a fallback for navigation callers that did not pass a storeRef
 * explicitly. An explicit ref always wins, since a caller may legitimately
 * link to a different store than the one currently being viewed.
 */
export function refFromPathname(pathname: string): string | null {
  if (typeof pathname !== "string") return null;
  const match = /^\/store\/([^/?#]+)/.exec(pathname);
  return match ? match[1] : null;
}
