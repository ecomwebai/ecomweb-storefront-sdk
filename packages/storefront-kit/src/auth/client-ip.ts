import "server-only";
import { serverConfig } from "../config/server";

/**
 * The shopper's IP, for forwarding to the backend, and the secret that makes
 * the backend believe it.
 *
 * Every auth call is now made server-side (`lib/auth/sdk.ts`, `lib/api/proxy.ts`,
 * the middleware's near-expiry refresh), so the backend's socket peer is this
 * Next server for every shopper of every store. Its throttler keys on
 * `storeId:clientIp` (`src/common/throttler/auth-throttler.guard.ts`), which
 * would collapse every shopper in a store into one 5-per-minute bucket unless
 * the real address travels with the request.
 *
 * The backend no longer takes `x-forwarded-for` on trust: its
 * `resolveClientIp` (`src/common/http/client-ip.ts` in the api repo) uses the
 * left-most entry ONLY when the request also carries `FORWARDER_SECRET_HEADER`
 * equal to its `CLIENT_IP_FORWARDER_SECRET`. Without the secret it falls back
 * to the peer address, i.e. this server's egress IP. So both headers travel
 * together, built in exactly one place: `forwardingHeaders()`.
 *
 * The value comes from the *incoming* request, from the header named by
 * `CLIENT_IP_HEADER` (server config): `x-forwarded-for` (default) where the
 * edge in front of this server overwrites it with the connecting address
 * (Vercel does, with `x-real-ip` too), or `cf-connecting-ip` behind
 * Cloudflare → Caddy → Kong, where proxies append to X-Forwarded-For and its
 * left end is whatever the shopper sent. Anything a browser sends
 * itself is stripped before it can reach the backend — see
 * `BLOCKED_REQUEST_HEADERS` in `lib/api/proxy.ts`, which drops these headers
 * and then re-sets them from this module. Order matters: block, then set.
 *
 * `server-only` because this module reads the secret. It must never be pulled
 * into a client bundle: the secret is what lets a caller choose the IP the
 * backend rate-limits on.
 */

/** Must match `FORWARDER_SECRET_HEADER` in the api repo's client-ip.ts. */
export const FORWARDER_SECRET_HEADER = "x-ecomweb-forwarder-secret";

const IPV4 =
  /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

/**
 * A syntactic IPv4/IPv6 check that works in every runtime this module is
 * bundled for (Node route handlers and the middleware), hence no `node:net`.
 * IPv6 syntax is delegated to the WHATWG URL parser, which rejects anything
 * that is not a valid IPv6 literal inside brackets.
 */
export function isIpAddress(value: string): boolean {
  if (IPV4.test(value)) return true;
  if (!value.includes(":") || !/^[0-9a-fA-F:.]+$/.test(value)) return false;
  try {
    new URL(`http://[${value}]/`);
    return true;
  } catch {
    return false;
  }
}

function validIp(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed && isIpAddress(trimmed) ? trimmed : undefined;
}

/**
 * @param headers the incoming request's headers
 * @returns with `CLIENT_IP_HEADER=cf-connecting-ip`, that header if it is a
 *   well-formed IP (never a fallback to X-Forwarded-For, which the shopper
 *   controls there); otherwise the first (left-most) `x-forwarded-for` entry,
 *   else `x-real-ip`. `undefined` when none is a well-formed IP.
 */
export function clientIpFrom(headers: {
  get(name: string): string | null;
}): string | undefined {
  if (serverConfig().clientIpHeader === "cf-connecting-ip") {
    return validIp(headers.get("cf-connecting-ip"));
  }
  return (
    validIp(headers.get("x-forwarded-for")?.split(",")[0]) ??
    validIp(headers.get("x-real-ip"))
  );
}

/** The server-only secret, or `undefined` when unset/blank. */
function forwarderSecret(): string | undefined {
  return serverConfig().clientIpForwarderSecret;
}

/**
 * Headers that carry the shopper's address to the backend:
 * `x-forwarded-for` set to the single validated IP, plus the forwarder secret
 * when `CLIENT_IP_FORWARDER_SECRET` is set. `{}` when no IP is known.
 *
 * Never sends an empty or placeholder value: the backend falls back to its own
 * view of the peer address, and a literal `"unknown"` would be one more shared
 * bucket rather than none. The secret is only sent alongside an IP, since on
 * its own it asserts nothing.
 *
 * @param clientIp the shopper's address, from `clientIpFrom(...)`. Re-validated
 *   here so a caller can never smuggle a chain or a non-IP through.
 */
export function forwardingHeaders(clientIp?: string): Record<string, string> {
  const ip = validIp(clientIp);
  if (!ip) return {};

  const secret = forwarderSecret();
  return secret
    ? { "x-forwarded-for": ip, [FORWARDER_SECRET_HEADER]: secret }
    : { "x-forwarded-for": ip };
}

/** `forwardingHeaders(clientIpFrom(headers))`. */
export function forwardedForHeader(headers: {
  get(name: string): string | null;
}): Record<string, string> {
  return forwardingHeaders(clientIpFrom(headers));
}
