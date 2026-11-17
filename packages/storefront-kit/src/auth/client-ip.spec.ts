import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import {
  clientIpFrom,
  FORWARDER_SECRET_HEADER,
  forwardedForHeader,
  forwardingHeaders,
  isIpAddress,
} from "./client-ip";
import { handleBackendProxy } from "../api/proxy";
import { createAuthApi } from "./sdk";
import { resetPublicConfigForTests } from "../config/public";
import { resetServerConfigForTests } from "../config/server";

// Config is cached on first read; these specs stub env per test.
beforeEach(() => {
  resetPublicConfigForTests();
  resetServerConfigForTests();
});

const SECRET = "test-forwarder-secret";

function incoming(init: Record<string, string>) {
  return new Headers(init);
}

describe("clientIpFrom", () => {
  it("takes only the validated first entry of a spoofed multi-entry chain", () => {
    const headers = incoming({
      "x-forwarded-for": "203.0.113.7, 10.0.0.1, 198.51.100.9",
    });
    expect(clientIpFrom(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when the first x-forwarded-for entry is not an IP", () => {
    const headers = incoming({
      "x-forwarded-for": "not-an-ip, 203.0.113.7",
      "x-real-ip": "198.51.100.9",
    });
    expect(clientIpFrom(headers)).toBe("198.51.100.9");
  });

  it("returns undefined when nothing is a well-formed IP", () => {
    expect(
      clientIpFrom(incoming({ "x-forwarded-for": "unknown", "x-real-ip": "" }))
    ).toBeUndefined();
    expect(clientIpFrom(incoming({}))).toBeUndefined();
  });

  it("accepts IPv6", () => {
    expect(clientIpFrom(incoming({ "x-forwarded-for": "2001:db8::1" }))).toBe(
      "2001:db8::1"
    );
  });
});

describe("isIpAddress", () => {
  it.each(["1.2.3.4", "255.255.255.255", "::1", "2001:db8::1", "::ffff:1.2.3.4"])(
    "accepts %s",
    (ip) => expect(isIpAddress(ip)).toBe(true)
  );

  it.each([
    "256.1.1.1",
    "1.2.3",
    "1.2.3.4:80",
    "01.2.3.4",
    "1.2.3.4, 5.6.7.8",
    "2001:db8:::1",
    "evil.example.com",
    "[::1]",
    "",
  ])("rejects %j", (ip) => expect(isIpAddress(ip)).toBe(false));
});

describe("forwardingHeaders", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("attaches the shopper IP and the secret when CLIENT_IP_FORWARDER_SECRET is set", () => {
    vi.stubEnv("CLIENT_IP_FORWARDER_SECRET", SECRET);
    expect(forwardingHeaders("203.0.113.7")).toEqual({
      "x-forwarded-for": "203.0.113.7",
      [FORWARDER_SECRET_HEADER]: SECRET,
    });
  });

  it("omits the secret header entirely when the var is unset", () => {
    vi.stubEnv("CLIENT_IP_FORWARDER_SECRET", undefined);
    const headers = forwardingHeaders("203.0.113.7");
    expect(headers).toEqual({ "x-forwarded-for": "203.0.113.7" });
    expect(FORWARDER_SECRET_HEADER in headers).toBe(false);
  });

  it("omits the secret header when the var is blank", () => {
    vi.stubEnv("CLIENT_IP_FORWARDER_SECRET", "   ");
    expect(forwardingHeaders("203.0.113.7")).toEqual({
      "x-forwarded-for": "203.0.113.7",
    });
  });

  it("sends nothing, secret included, when no valid IP is known", () => {
    vi.stubEnv("CLIENT_IP_FORWARDER_SECRET", SECRET);
    expect(forwardingHeaders(undefined)).toEqual({});
    expect(forwardingHeaders("1.2.3.4, 5.6.7.8")).toEqual({});
  });

  it("forwardedForHeader reduces a spoofed chain to its validated first entry", () => {
    vi.stubEnv("CLIENT_IP_FORWARDER_SECRET", SECRET);
    expect(
      forwardedForHeader(
        incoming({ "x-forwarded-for": "203.0.113.7, 6.6.6.6, 7.7.7.7" })
      )
    ).toEqual({
      "x-forwarded-for": "203.0.113.7",
      [FORWARDER_SECRET_HEADER]: SECRET,
    });
  });
});

describe("server-side API calls carry the forwarding headers", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_API_KEY", "pk_test");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  function sentHeaders(): Headers {
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    return new Headers(init.headers);
  }

  it("auth SDK calls (login, refresh, ...) send the shopper IP and the secret", async () => {
    vi.stubEnv("CLIENT_IP_FORWARDER_SECRET", SECRET);
    const ip = clientIpFrom(
      incoming({ "x-forwarded-for": "203.0.113.7, 6.6.6.6" })
    );

    await createAuthApi("store-a", ip).refresh("rt");

    const headers = sentHeaders();
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(headers.get(FORWARDER_SECRET_HEADER)).toBe(SECRET);
    expect(headers.get("x-storefront-api-key")).toBe("sk_storefront_test");
  });

  it("auth SDK calls omit the secret when the var is unset", async () => {
    vi.stubEnv("CLIENT_IP_FORWARDER_SECRET", undefined);

    await createAuthApi("store-a", "203.0.113.7").refresh("rt");

    const headers = sentHeaders();
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(headers.has(FORWARDER_SECRET_HEADER)).toBe(false);
  });

  it("the backend proxy strips browser-sent XFF/secret and sets its own", async () => {
    vi.stubEnv("CLIENT_IP_FORWARDER_SECRET", SECRET);
    const request = new NextRequest(
      "https://shop.example/store/store-a/api/backend/storefront/stores/store-a/cart",
      {
        headers: {
          "sec-fetch-site": "same-origin",
          "x-forwarded-for": "203.0.113.7, 6.6.6.6",
          "x-real-ip": "6.6.6.6",
          [FORWARDER_SECRET_HEADER]: "forged",
        },
      }
    );

    await handleBackendProxy(request, "store-a", [
      "storefront",
      "stores",
      "store-a",
      "cart",
    ]);

    const headers = sentHeaders();
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(headers.get(FORWARDER_SECRET_HEADER)).toBe(SECRET);
    expect(headers.has("x-real-ip")).toBe(false);
  });

  it("the backend proxy drops a browser-sent secret when the var is unset", async () => {
    vi.stubEnv("CLIENT_IP_FORWARDER_SECRET", undefined);
    const request = new NextRequest(
      "https://shop.example/store/store-a/api/backend/storefront/stores/store-a/cart",
      {
        headers: {
          "sec-fetch-site": "same-origin",
          "x-forwarded-for": "203.0.113.7",
          [FORWARDER_SECRET_HEADER]: "forged",
        },
      }
    );

    await handleBackendProxy(request, "store-a", [
      "storefront",
      "stores",
      "store-a",
      "cart",
    ]);

    const headers = sentHeaders();
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(headers.has(FORWARDER_SECRET_HEADER)).toBe(false);
  });
});

describe("clientIpFrom behind Cloudflare (CLIENT_IP_HEADER=cf-connecting-ip)", () => {
  beforeEach(() => vi.stubEnv("CLIENT_IP_HEADER", "cf-connecting-ip"));
  afterEach(() => vi.unstubAllEnvs());

  it("trusts CF-Connecting-IP over a shopper-sent X-Forwarded-For", () => {
    const headers = incoming({
      "cf-connecting-ip": "203.0.113.7",
      "x-forwarded-for": "6.6.6.6, 203.0.113.7",
    });
    expect(clientIpFrom(headers)).toBe("203.0.113.7");
  });

  it("forwards no IP rather than a forged X-Forwarded-For", () => {
    expect(
      clientIpFrom(incoming({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.6" }))
    ).toBeUndefined();
  });

  it("ignores a malformed CF-Connecting-IP", () => {
    expect(clientIpFrom(incoming({ "cf-connecting-ip": "6.6.6.6, 7.7.7.7" }))).toBeUndefined();
  });

  it("the backend proxy never forwards the incoming CF-Connecting-IP header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_API_KEY", "pk_test");
    const request = new NextRequest(
      "https://shop.example/store/store-a/api/backend/storefront/stores/store-a/cart",
      { headers: { "sec-fetch-site": "same-origin", "cf-connecting-ip": "203.0.113.7" } }
    );

    await handleBackendProxy(request, "store-a", ["storefront", "stores", "store-a", "cart"]);

    const sent = new Headers((fetchMock.mock.calls[0][1] as RequestInit).headers);
    expect(sent.has("cf-connecting-ip")).toBe(false);
    expect(sent.get("x-forwarded-for")).toBe("203.0.113.7");
    vi.unstubAllGlobals();
  });
});
