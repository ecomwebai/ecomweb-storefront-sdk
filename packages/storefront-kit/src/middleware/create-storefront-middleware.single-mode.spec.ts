import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createStorefrontMiddleware } from "./create-storefront-middleware";

// Hoisted above the imports: the middleware entry loads modules that read
// the config while importing, and the config is memoized on first read.
vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "single");
  vi.stubEnv("NEXT_PUBLIC_ECOMWEB_STORE_REF", "demo");
  vi.stubEnv("NEXT_PUBLIC_ECOMWEB_PUBLISHABLE_KEY", "pk_demo");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://shop.example.com");
});
const proxy = createStorefrontMiddleware();

const { lookupRedirect } = vi.hoisted(() => ({ lookupRedirect: vi.fn() }));
vi.mock("../redirects/lookup-redirect", () => ({
  lookupRedirect,
}));

describe("proxy (single)", () => {
  beforeEach(() => {
    lookupRedirect.mockReset().mockResolvedValue(null);
  });

  it("never rewrites to /store/<ref>", async () => {
    const res = await proxy(
      new NextRequest("https://shop.example.com/products/x")
    );
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("applies a store redirect at the root", async () => {
    lookupRedirect.mockResolvedValue({
      destination_path: "/new",
      redirect_type: 301,
    });
    const res = await proxy(new NextRequest("https://shop.example.com/old"));
    expect(lookupRedirect).toHaveBeenCalledWith("demo", "/old");
    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toBe("https://shop.example.com/new");
  });

  it("keeps a store redirect's destination query", async () => {
    lookupRedirect.mockResolvedValue({
      destination_path: "/new?a=b",
      redirect_type: 301,
    });
    const res = await proxy(new NextRequest("https://shop.example.com/old"));
    expect(res.headers.get("location")).toBe(
      "https://shop.example.com/new?a=b"
    );
  });

  it("stamps the request as host-mapped so cookies use Path=/", async () => {
    const res = await proxy(new NextRequest("https://shop.example.com/"));
    expect(res.headers.get("x-middleware-request-x-ecomweb-host-mapped")).toBe(
      "1"
    );
  });
});

describe("proxy (single) — theme preview links", () => {
  beforeEach(() => {
    lookupRedirect.mockReset().mockResolvedValue(null);
  });

  it("turns ?preview_theme into a cookie at Path=/", async () => {
    const res = await proxy(
      new NextRequest("https://shop.example.com/?preview_theme=tok")
    );
    expect(res.status).toBe(307);
    expect(res.cookies.get("ecomweb_theme_preview")?.path).toBe("/");
  });

  it("marks previewed pages noindex", async () => {
    const res = await proxy(
      new NextRequest("https://shop.example.com/", {
        headers: { cookie: "ecomweb_theme_preview=tok" },
      })
    );
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });
});

describe("proxy (single) — store preview links", () => {
  beforeEach(() => {
    lookupRedirect.mockReset().mockResolvedValue(null);
  });

  it("turns /preview?token into a cookie at Path=/ and goes home", async () => {
    const res = await proxy(
      new NextRequest("https://shop.example.com/preview?token=tok")
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://shop.example.com/");
    const cookie = res.cookies.get("ecw_store_preview");
    expect(cookie?.value).toBe("tok");
    expect(cookie?.path).toBe("/");
    expect(lookupRedirect).not.toHaveBeenCalled();
  });

  it("marks pages noindex under a store preview cookie", async () => {
    const res = await proxy(
      new NextRequest("https://shop.example.com/", {
        headers: { cookie: "ecw_store_preview=tok" },
      })
    );
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("never passes on a store preview token the client sent", async () => {
    const res = await proxy(
      new NextRequest("https://shop.example.com/", {
        headers: { "x-ecomweb-store-preview-token": "forged" },
      })
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(
      res.headers.get("x-middleware-request-x-ecomweb-store-preview-token")
    ).toBeNull();
  });
});

describe("proxy (single) — internal headers on metadata files", () => {
  it("drops a client's copy there too", async () => {
    const res = await proxy(
      new NextRequest("https://shop.example.com/robots.txt", {
        headers: {
          "x-ecomweb-store-preview-token": "forged",
          "x-ecomweb-preview-slug": "forged",
        },
      })
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
    const overridden = res.headers.get("x-middleware-override-headers");
    expect(overridden).not.toBeNull();
    expect(overridden!.split(",")).not.toContain(
      "x-ecomweb-store-preview-token"
    );
    expect(overridden!.split(",")).not.toContain("x-ecomweb-preview-slug");
  });
});
