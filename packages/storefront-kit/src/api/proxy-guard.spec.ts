import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { config } = vi.hoisted(() => ({
  config: { mode: "multi", storeRef: "demo" as string | null },
}));
vi.mock("../config/public", () => ({ publicConfig: () => config }));

import { isSameOriginRequest, servedStoreRef } from "./proxy-guard";

describe("isSameOriginRequest", () => {
  it.each([
    [{ "sec-fetch-site": "same-origin" }, true],
    [
      { "sec-fetch-site": "same-site", origin: "https://a.ecomsite.app" },
      false,
    ],
    [{ "sec-fetch-site": "cross-site" }, false],
    [{ "sec-fetch-site": "none" }, false],
    [{ origin: "https://a.ecomsite.app" }, true],
    [{ origin: "https://b.ecomsite.app" }, false],
    // Old Safari (before 16.4) sends no Sec-Fetch-*, and browsers send no
    // Origin on a same-origin GET: such a read is let through (ruling).
    [{}, true],
  ])("isSameOriginRequest(%o) on a GET is %s", (headers, ok) => {
    expect(
      isSameOriginRequest(
        new NextRequest("https://a.ecomsite.app/store/a/api/backend/x", {
          headers,
        })
      )
    ).toBe(ok);
  });

  it.each([
    ["GET", {}, true],
    ["HEAD", {}, true],
    ["POST", {}, false],
    ["PATCH", {}, false],
    ["DELETE", {}, false],
    ["GET", { "sec-fetch-site": "cross-site" }, false],
    ["GET", { origin: "https://evil.test" }, false],
    ["POST", { "sec-fetch-site": "same-origin" }, true],
    ["POST", { origin: "https://a.ecomsite.app" }, true],
  ] as const)("a %s with %o is %s", (method, headers, ok) => {
    expect(
      isSameOriginRequest(
        new NextRequest("https://a.ecomsite.app/store/a/api/backend/x", {
          method,
          headers,
        })
      )
    ).toBe(ok);
  });

  it("uses the forwarded host behind a proxy", () => {
    const req = new NextRequest("http://0.0.0.0:3000/store/a/api/backend/x", {
      headers: {
        host: "shop.test",
        "x-forwarded-proto": "https",
        origin: "https://shop.test",
      },
    });
    expect(isSameOriginRequest(req)).toBe(true);
  });
});

describe("servedStoreRef", () => {
  const headers = (
    v: string | null,
    pathname = "/store/abc/api/backend/x"
  ) => ({
    headers: {
      get: (n: string) => (n === "x-ecomweb-served-store" ? v : null),
    },
    nextUrl: { pathname },
  });

  it("reads the middleware's stamp in multi mode", () => {
    config.mode = "multi";
    expect(servedStoreRef(headers("abc"))).toBe("abc");
  });

  it("is null in multi mode without a stamp", () => {
    config.mode = "multi";
    expect(servedStoreRef(headers(null))).toBeNull();
  });

  it("is the configured store in single mode, ignoring any stamp", () => {
    config.mode = "single";
    expect(servedStoreRef(headers("evil", "/api/auth/login"))).toBe("demo");
  });

  it("ignores a forged stamp on /api/auth/*, outside the middleware matcher", () => {
    config.mode = "multi";
    expect(servedStoreRef(headers("evil", "/api/auth/login"))).toBeNull();
  });
});
