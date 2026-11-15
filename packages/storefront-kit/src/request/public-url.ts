import type { NextRequest } from "next/server";

const HOST = /^[a-z0-9.-]+(:\d{1,5})?$/i;
const first = (value: string | null) => value?.split(",")[0]?.trim() || null;

/**
 * The request's URL as the shopper sees it. Behind a proxy (Kong in front of
 * ecomweb hosting, or any load balancer) a standalone Next server's
 * request.url carries its own bind address, e.g. http://0.0.0.0:3000, so a
 * redirect built from it sends the browser nowhere. The proxy's Host and
 * X-Forwarded-* headers carry the store's real host and scheme; values that
 * aren't a plain host or http(s) are ignored.
 */
export function publicNextUrl(request: Pick<NextRequest, "headers" | "nextUrl">): URL {
  const url = new URL(request.nextUrl.toString());
  const host = [first(request.headers.get("x-forwarded-host")), first(request.headers.get("host"))].find(
    (h): h is string => !!h && HOST.test(h),
  );
  const proto = first(request.headers.get("x-forwarded-proto"));
  if (proto === "https" || proto === "http") url.protocol = `${proto}:`;
  if (host) {
    // Assigning host alone would keep the bind address's port.
    const [hostname, port = ""] = host.split(":");
    url.hostname = hostname!;
    url.port = port;
  }
  return url;
}
