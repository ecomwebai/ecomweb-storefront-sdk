import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  createStorefrontMiddleware,
  storefrontMiddlewareConfig as config,
} from "./create-storefront-middleware";

vi.hoisted(() => {
  vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
});

const proxy = createStorefrontMiddleware({ mode: "multi" });

const { getStoreByHost, getStoreSubdomain, lookupRedirect } = vi.hoisted(
  () => ({
    getStoreByHost: vi.fn(),
    getStoreSubdomain: vi.fn(),
    lookupRedirect: vi.fn(),
  })
);

// vi.mock calls are hoisted above imports, so `proxy` above resolves
// against this mocked getStoreByHost, not the real one.
vi.mock("../stores/get-store-by-host", () => ({
  getStoreByHost,
}));

const { recordStoreRequest } = vi.hoisted(() => ({
  recordStoreRequest: vi.fn(),
}));

vi.mock("../stores/store-traffic", () => ({
  recordStoreRequest,
}));

vi.mock("../stores/store-subdomain", () => ({
  getStoreSubdomain,
}));

vi.mock("../redirects/lookup-redirect", () => ({
  lookupRedirect,
}));

describe("proxy — suspended-store host resolution", () => {
  beforeEach(() => {
    getStoreByHost.mockReset();
    lookupRedirect.mockReset();
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  it("rewrites a suspended custom domain to /store-suspended, not /store/<ref> or /404", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: null,
      domain: null,
      isSubDomain: false,
      suspended: true,
    });

    const req = new NextRequest("https://shop.example.com/products/widget", {
      headers: { host: "shop.example.com" },
    });

    const response = await proxy(req);

    // NextResponse.rewrite carries the target on the `x-middleware-rewrite`
    // header rather than exposing it as a plain URL property.
    const rewriteTarget = response.headers.get("x-middleware-rewrite");
    expect(rewriteTarget).toContain("/store-suspended");
    expect(rewriteTarget).not.toContain("/store/");
    expect(rewriteTarget).not.toContain("/404");
  });

  it("still rewrites to /404 for a host that resolves to nothing (not suspended)", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: null,
      domain: null,
      isSubDomain: false,
      suspended: false,
    });

    const req = new NextRequest("https://unknown-host.example.com/", {
      headers: { host: "unknown-host.example.com" },
    });

    const response = await proxy(req);

    const rewriteTarget = response.headers.get("x-middleware-rewrite");
    expect(rewriteTarget).toContain("/404");
  });

  it("rewrites a resolved store's domain to /store/<ref>, unaffected by the suspended branch", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: "shop.example.com",
      isSubDomain: false,
      suspended: false,
    });

    const req = new NextRequest("https://shop.example.com/products/widget", {
      headers: { host: "shop.example.com" },
    });

    const response = await proxy(req);

    const rewriteTarget = response.headers.get("x-middleware-rewrite");
    expect(rewriteTarget).toContain("/store/abc123/products/widget");
    expect(response.headers.get("x-store-ref")).toBe("abc123");
  });
});

describe("proxy — coming soon stores", () => {
  const comingSoon = {
    storeRef: null,
    domain: null,
    isSubDomain: false,
    suspended: false,
    externalUrl: null,
    previewSlug: null,
    comingSoon: true,
    comingSoonName: "Tiệm Hoa",
    storePreviewToken: null,
  };
  const open = {
    ...comingSoon,
    storeRef: "abc123",
    comingSoon: false,
    comingSoonName: null,
  };
  const onShop = (path: string, headers: Record<string, string> = {}) =>
    new NextRequest(`https://shop.example.com${path}`, {
      headers: { host: "shop.example.com", ...headers },
    });
  const forwardedToken = (res: Response) =>
    res.headers.get("x-middleware-request-x-ecomweb-store-preview-token");

  beforeEach(() => {
    getStoreByHost.mockReset();
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  it("rewrites a coming soon custom domain to /coming-soon, noindex", async () => {
    getStoreByHost.mockResolvedValue(comingSoon);
    const res = await proxy(onShop("/products/a"));
    const target = res.headers.get("x-middleware-rewrite");
    expect(target).toContain("/coming-soon");
    expect(target).not.toContain("/store/");
    expect(target).not.toContain("/404");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("turns /preview?token into a host cookie before any lookup", async () => {
    const res = await proxy(onShop("/preview?token=tok"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://shop.example.com/");
    const cookie = res.cookies.get("ecw_store_preview");
    expect(cookie?.value).toBe("tok");
    expect(cookie?.path).toBe("/");
    expect(getStoreByHost).not.toHaveBeenCalled();
  });

  it("turns /store/<ref>/preview?token into a path cookie on localhost", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3002/store/abc123/preview?token=tok", {
        headers: { host: "localhost:3002" },
      })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3002/store/abc123"
    );
    const cookie = res.cookies.get("ecw_store_preview");
    expect(cookie?.value).toBe("tok");
    expect(cookie?.path).toBe("/store/abc123");
  });

  it("looks the host up with the preview token", async () => {
    getStoreByHost.mockResolvedValue(open);
    const res = await proxy(
      onShop("/products/a", { cookie: "ecw_store_preview=tok" })
    );
    expect(getStoreByHost).toHaveBeenCalledWith("shop.example.com", {
      previewToken: "tok",
    });
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://shop.example.com/store/abc123/products/a"
    );
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("falls back to the theme preview cookie for the lookup's token", async () => {
    getStoreByHost.mockResolvedValue(open);
    await proxy(onShop("/", { cookie: "ecomweb_theme_preview=theme.tok" }));
    expect(getStoreByHost).toHaveBeenCalledWith("shop.example.com", {
      previewToken: "theme.tok",
    });
  });

  it("prefers the store preview cookie over the theme preview cookie", async () => {
    getStoreByHost.mockResolvedValue(open);
    await proxy(
      onShop("/", {
        cookie: "ecomweb_theme_preview=theme.tok; ecw_store_preview=store.tok",
      })
    );
    expect(getStoreByHost).toHaveBeenCalledWith("shop.example.com", {
      previewToken: "store.tok",
    });
  });

  it("looks the host up without a token when there is no preview cookie", async () => {
    getStoreByHost.mockResolvedValue(open);
    await proxy(onShop("/"));
    expect(getStoreByHost).toHaveBeenCalledTimes(1);
    expect(getStoreByHost.mock.calls[0]).toEqual(["shop.example.com"]);
  });

  it("never takes the lookup's token from a header the client sent", async () => {
    getStoreByHost.mockResolvedValue(comingSoon);
    const res = await proxy(
      onShop("/products/a", { "x-ecomweb-store-preview-token": "forged" })
    );
    expect(getStoreByHost.mock.calls[0]).toEqual(["shop.example.com"]);
    expect(res.headers.get("x-middleware-rewrite")).toContain("/coming-soon");
    expect(forwardedToken(res)).toBeNull();
    expect(
      res.headers.get("x-middleware-override-headers") ?? ""
    ).not.toContain("x-ecomweb-store-preview-token");
  });

  it("turns ?preview_theme into a host cookie on a coming soon host", async () => {
    getStoreByHost.mockResolvedValue(comingSoon);
    const res = await proxy(onShop("/?preview_theme=tok"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://shop.example.com/");
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    const cookie = res.cookies.get("ecomweb_theme_preview");
    expect(cookie?.value).toBe("tok");
    expect(cookie?.path).toBe("/");
  });

  it("keeps the path and the rest of the query on that redirect", async () => {
    getStoreByHost.mockResolvedValue(comingSoon);
    const res = await proxy(onShop("/products/a?preview_theme=tok&x=1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://shop.example.com/products/a?x=1"
    );
    expect(res.cookies.get("ecomweb_theme_preview")?.path).toBe("/");
  });

  it("an expired token still lands on the coming soon page", async () => {
    getStoreByHost.mockResolvedValue(comingSoon);
    const res = await proxy(
      onShop("/products/a", { cookie: "ecw_store_preview=expired" })
    );
    expect(getStoreByHost).toHaveBeenCalledWith("shop.example.com", {
      previewToken: "expired",
    });
    expect(res.headers.get("x-middleware-rewrite")).toContain("/coming-soon");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("serves robots.txt and sitemap.xml from the app for a coming soon host", async () => {
    getStoreByHost.mockResolvedValue(comingSoon);
    for (const path of ["/robots.txt", "/sitemap.xml"]) {
      const res = await proxy(onShop(path));
      expect(res.headers.get("x-middleware-rewrite")).toBeNull();
      expect(res.headers.get("location")).toBeNull();
      expect(res.headers.get("x-middleware-next")).toBe("1");
    }
  });

  it("marks a path-based store noindex under a store preview cookie", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3002/store/abc123/products/a", {
        headers: { host: "localhost:3002", cookie: "ecw_store_preview=tok" },
      })
    );
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("strips a client-sent token on a path-based request too", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3002/store/abc123/products/a", {
        headers: {
          host: "localhost:3002",
          "x-ecomweb-store-preview-token": "forged",
        },
      })
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(forwardedToken(res)).toBeNull();
  });
});

describe("proxy — URL redirects", () => {
  beforeEach(() => {
    getStoreByHost.mockReset();
    lookupRedirect.mockReset();
  });

  it("does not intercept _next, static assets, or API routes", () => {
    // Guards the matcher itself, not a per-request behaviour: these paths
    // never reach `proxy()` at all, so there is nothing to assert on a
    // response — only that the matcher's exclusions are still present.
    const pattern = config.matcher[0];
    expect(pattern).toContain("api");
    expect(pattern).toContain("_next/static");
    expect(pattern).toContain("_next/image");
    expect(pattern).toContain("favicon.ico");
  });

  it("leaves Vercel's own paths alone (else each one renders a store page off Vercel)", () => {
    // Next compiles the matcher as a full-path regex.
    const matches = (path: string) =>
      new RegExp(`^${config.matcher[0]}$`).test(path);
    expect(matches("/_vercel/insights/script.js")).toBe(false);
    expect(matches("/_vercel/speed-insights/vitals")).toBe(false);
    expect(matches("/products/shirt")).toBe(true);
    expect(matches("/api/health")).toBe(false);
  });

  it("301s a host-mapped request to a registered redirect's destination", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: null,
      isSubDomain: false,
      suspended: false,
    });
    lookupRedirect.mockResolvedValue({
      id: "r1",
      store_id: 2,
      source_path: "/old",
      destination_path: "/new2",
      redirect_type: 301,
      is_active: true,
      source_type: "manual",
      created_at: "",
      updated_at: "",
    });

    const req = new NextRequest("https://shop.example.com/old", {
      headers: { host: "shop.example.com" },
    });

    const response = await proxy(req);

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://shop.example.com/new2"
    );
    expect(lookupRedirect).toHaveBeenCalledWith("abc123", "/old");
  });

  it("301s a direct /store/<ref>/… request to a registered redirect's destination", async () => {
    lookupRedirect.mockResolvedValue({
      id: "r1",
      store_id: 2,
      source_path: "/old",
      destination_path: "/new2",
      redirect_type: 301,
      is_active: true,
      source_type: "manual",
      created_at: "",
      updated_at: "",
    });

    const req = new NextRequest("http://localhost:3000/store/abc123/old", {
      headers: { host: "localhost:3000" },
    });

    const response = await proxy(req);

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/store/abc123/new2"
    );
    // The redirect table stores the logical path without the /store/<ref>
    // prefix -- getStoreByHost is never even consulted on localhost, so the
    // only way this can pass is by resolving the ref from the path.
    expect(lookupRedirect).toHaveBeenCalledWith("abc123", "/old");
    expect(getStoreByHost).not.toHaveBeenCalled();
  });

  describe("a redirect destination's query", () => {
    const redirectTo = (destination_path: string) =>
      lookupRedirect.mockResolvedValue({
        id: "r1",
        store_id: 2,
        source_path: "/old",
        destination_path,
        redirect_type: 301,
        is_active: true,
        source_type: "manual",
        created_at: "",
        updated_at: "",
      });
    const hostMapped = (url: string) => {
      getStoreByHost.mockResolvedValue({
        storeRef: "abc123",
        domain: null,
        isSubDomain: false,
        suspended: false,
      });
      return proxy(
        new NextRequest(url, { headers: { host: "shop.example.com" } })
      );
    };

    it("keeps the destination's own query instead of encoding its ?", async () => {
      redirectTo("/collections/sale?sort=price&page=2");
      const response = await hostMapped("https://shop.example.com/old");
      expect(response.headers.get("location")).toBe(
        "https://shop.example.com/collections/sale?sort=price&page=2"
      );
    });

    it("prefers the destination's query over the request's", async () => {
      redirectTo("/new?a=b");
      const response = await hostMapped("https://shop.example.com/old?x=1");
      expect(response.headers.get("location")).toBe(
        "https://shop.example.com/new?a=b"
      );
    });

    it("carries the request's query over when the destination has none", async () => {
      redirectTo("/new");
      const response = await hostMapped(
        "https://shop.example.com/old?utm_source=fb"
      );
      expect(response.headers.get("location")).toBe(
        "https://shop.example.com/new?utm_source=fb"
      );
    });

    it("keeps the query behind the /store/<ref> prefix on direct access", async () => {
      redirectTo("/new?a=b");
      const response = await proxy(
        new NextRequest("http://localhost:3000/store/abc123/old", {
          headers: { host: "localhost:3000" },
        })
      );
      expect(response.headers.get("location")).toBe(
        "http://localhost:3000/store/abc123/new?a=b"
      );
    });

    it("stays on the store's host for a destination naming another one", async () => {
      redirectTo("//evil.example/new?a=b");
      const response = await hostMapped("https://shop.example.com/old");
      expect(response.headers.get("location")).toBe(
        "https://shop.example.com/new?a=b"
      );
    });
  });

  it("passes a direct /store/<ref>/… request through untouched when there is no redirect", async () => {
    lookupRedirect.mockResolvedValue(null);

    const req = new NextRequest(
      "http://localhost:3000/store/abc123/products/widget",
      { headers: { host: "localhost:3000" } }
    );

    const response = await proxy(req);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });

  it("fails open when the redirect lookup rejects, rather than erroring the page", async () => {
    lookupRedirect.mockRejectedValue(new Error("network down"));

    const req = new NextRequest("http://localhost:3000/store/abc123/old", {
      headers: { host: "localhost:3000" },
    });

    const response = await proxy(req);

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("proxy — subdomain to custom domain redirect", () => {
  beforeEach(() => {
    getStoreByHost.mockReset();
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  const onSubdomain = () =>
    proxy(
      new NextRequest("https://shop.ecomsite.app/products/x?a=1", {
        headers: { host: "shop.ecomsite.app" },
      })
    );

  it("301s to the custom domain with a short Cache-Control", async () => {
    // getStoreByHost reports `domain` only once the domain is verified.
    getStoreByHost.mockResolvedValue({
      storeRef: "s1",
      domain: "www.shop.vn",
      isSubDomain: true,
      suspended: false,
    });

    const response = await onSubdomain();

    expect(response.status).toBe(301);
    expect(response.headers.get("location")).toBe(
      "https://www.shop.vn/products/x?a=1"
    );
    // Uncached, browsers would follow it forever, even after the merchant
    // removes a broken domain.
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
  });

  it("serves the store on the subdomain while there is no verified domain", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "s1",
      domain: null,
      isSubDomain: true,
      suspended: false,
    });

    const response = await onSubdomain();

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/store/s1/products/x"
    );
  });
});

describe("createStorefrontMiddleware mode", () => {
  beforeEach(() => {
    getStoreByHost.mockReset();
    lookupRedirect.mockReset().mockResolvedValue(null);
  });

  it("takes the mode from the config when none is passed", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "s1",
      domain: null,
      isSubDomain: true,
      suspended: false,
    });
    const response = await createStorefrontMiddleware()(
      new NextRequest("https://shop.ecomsite.app/products/x", {
        headers: { host: "shop.ecomsite.app" },
      })
    );
    expect(response.headers.get("x-middleware-rewrite")).toContain(
      "/store/s1/products/x"
    );
  });
});

describe("proxy — theme preview links (multi)", () => {
  beforeEach(() => {
    getStoreByHost.mockReset();
    lookupRedirect.mockReset().mockResolvedValue(null);
  });

  it("turns ?preview_theme into a cookie scoped to /store/<ref> on the shared host", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3000/store/abc123/?preview_theme=tok", {
        headers: { host: "localhost:3000" },
      })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/store/abc123/"
    );
    const cookie = res.cookies.get("ecomweb_theme_preview");
    expect(cookie?.value).toBe("tok");
    expect(cookie?.path).toBe("/store/abc123");
  });

  it("marks pages rendered under a preview cookie noindex", async () => {
    const req = new NextRequest("http://localhost:3000/store/abc123/", {
      headers: { host: "localhost:3000", cookie: "ecomweb_theme_preview=tok" },
    });
    const res = await proxy(req);
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });
});

describe("proxy — external theme live (theme anatomy)", () => {
  const external = (
    over: Partial<{
      storeRef: string | null;
      domain: string | null;
      isSubDomain: boolean;
      externalUrl: string | null;
    }> = {}
  ) => ({
    storeRef: "abc123",
    domain: null,
    isSubDomain: true,
    suspended: false,
    externalUrl: "https://shop.example.com",
    ...over,
  });
  const onSubdomain = (
    path: string,
    init: { method?: string; cookie?: string } = {}
  ) =>
    new NextRequest(`https://abc.ecomsite.app${path}`, {
      method: init.method,
      headers: {
        host: "abc.ecomsite.app",
        ...(init.cookie ? { cookie: init.cookie } : {}),
      },
    });

  beforeEach(() => {
    getStoreByHost.mockReset();
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  it("302s to the external site with the path and query exactly", async () => {
    getStoreByHost.mockResolvedValue(external());
    const res = await proxy(onSubdomain("/products/ao-thun?color=den"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://shop.example.com/products/ao-thun?color=den"
    );
    // The store's own URL redirects are the external site's business now.
    expect(lookupRedirect).not.toHaveBeenCalled();
  });

  it("goes before the subdomain → custom domain redirect", async () => {
    getStoreByHost.mockResolvedValue(
      external({ domain: "shop.brand.vn", externalUrl: "https://www.brand.vn" })
    );
    const res = await proxy(onSubdomain("/collections/sale"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://www.brand.vn/collections/sale"
    );
  });

  it("uses 307 for a non-GET request, so the method survives", async () => {
    getStoreByHost.mockResolvedValue(external());
    const res = await proxy(onSubdomain("/contact", { method: "POST" }));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://shop.example.com/contact"
    );
  });

  it("redirects robots.txt and sitemap.xml too", async () => {
    getStoreByHost.mockResolvedValue(external());
    for (const path of ["/robots.txt", "/sitemap.xml"]) {
      const res = await proxy(onSubdomain(path));
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toBe(
        `https://shop.example.com${path}`
      );
    }
  });

  it("serves robots.txt from the app when no external theme is live", async () => {
    getStoreByHost.mockResolvedValue(external({ externalUrl: null }));
    const res = await proxy(onSubdomain("/robots.txt"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("leaves the other metadata files alone (no lookup)", async () => {
    getStoreByHost.mockResolvedValue(external());
    const res = await proxy(onSubdomain("/manifest.webmanifest"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(getStoreByHost).not.toHaveBeenCalled();
  });

  it("never redirects a preview link; the link still becomes a cookie", async () => {
    getStoreByHost.mockResolvedValue(external());
    const res = await proxy(onSubdomain("/products/a?preview_theme=tok&x=1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://abc.ecomsite.app/products/a?x=1"
    );
    expect(res.cookies.get("ecomweb_theme_preview")?.value).toBe("tok");
  });

  it("does not redirect while a preview cookie is open", async () => {
    getStoreByHost.mockResolvedValue(external());
    const res = await proxy(
      onSubdomain("/products/a", { cookie: "ecomweb_theme_preview=tok" })
    );
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toContain(
      "/store/abc123/products/a"
    );
  });

  it("shows 'domain not connected' when the external URL is this very host", async () => {
    getStoreByHost.mockResolvedValue(
      external({
        isSubDomain: false,
        domain: "shop.example.com",
        externalUrl: "https://Shop.Example.com",
      })
    );
    const res = await proxy(
      new NextRequest("https://shop.example.com/products/a", {
        headers: { host: "shop.example.com" },
      })
    );
    expect(res.headers.get("location")).toBeNull();
    const target = res.headers.get("x-middleware-rewrite");
    expect(target).toContain("/domain-not-connected");
    expect(target).not.toContain("/store/");
  });

  it("keeps serving robots.txt itself when the external URL is this very host", async () => {
    getStoreByHost.mockResolvedValue(
      external({ isSubDomain: false, externalUrl: "https://shop.example.com" })
    );
    const res = await proxy(
      new NextRequest("https://shop.example.com/robots.txt", {
        headers: { host: "shop.example.com" },
      })
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("does not redirect when the field is absent (API before external themes)", async () => {
    const { externalUrl: _omit, ...older } = external();
    getStoreByHost.mockResolvedValue(older);
    const res = await proxy(onSubdomain("/products/a"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toContain(
      "/store/abc123/products/a"
    );
  });

  it("does not redirect to a URL that is not https", async () => {
    getStoreByHost.mockResolvedValue(
      external({ externalUrl: "http://shop.example.com" })
    );
    const res = await proxy(onSubdomain("/"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("tells the render the request's own path (the layout backstop reads it)", async () => {
    lookupRedirect.mockResolvedValue(null);
    const res = await proxy(
      new NextRequest("http://localhost:3000/store/abc123/products/a?x=1", {
        headers: {
          host: "localhost:3000",
          "x-ecomweb-request-path": "/forged",
        },
      })
    );
    expect(res.headers.get("x-middleware-request-x-ecomweb-request-path")).toBe(
      "/store/abc123/products/a?x=1"
    );
  });

  it("fails open when the store lookup throws", async () => {
    getStoreByHost.mockRejectedValue(new Error("api down"));
    const res = await proxy(onSubdomain("/products/a"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("proxy — a theme's preview host, p-<slug>", () => {
  const onPreviewHost = (path: string, headers: Record<string, string> = {}) =>
    new NextRequest(`https://p-x3hm7wca.ecomsite.app${path}`, {
      headers: { host: "p-x3hm7wca.ecomsite.app", ...headers },
    });
  const forwarded = (res: Response) =>
    res.headers.get("x-middleware-request-x-ecomweb-preview-slug");
  const forwardedToken = (res: Response) =>
    res.headers.get("x-middleware-request-x-ecomweb-store-preview-token");

  beforeEach(() => {
    getStoreByHost.mockReset().mockResolvedValue({
      storeRef: "abc123",
      // The store has a custom domain: a preview host is not redirected there.
      domain: "www.shop.vn",
      isSubDomain: true,
      suspended: false,
      externalUrl: null,
      previewSlug: "x3hm7wca",
    });
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  it("renders the store there, naming the slug to the page, noindex", async () => {
    const res = await proxy(onPreviewHost("/products/a"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://p-x3hm7wca.ecomsite.app/store/abc123/products/a"
    );
    expect(forwarded(res)).toBe("x3hm7wca");
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("still takes the theme editor's token, for its draft", async () => {
    const res = await proxy(onPreviewHost("/?preview_theme=tok"));
    expect(res.status).toBe(307);
    expect(res.cookies.get("ecomweb_theme_preview")?.path).toBe("/");
  });

  it("disallows everything in robots.txt and has no sitemap", async () => {
    const robots = await proxy(onPreviewHost("/robots.txt"));
    expect(await robots.text()).toBe("User-agent: *\nDisallow: /\n");
    const sitemap = await proxy(onPreviewHost("/sitemap.xml"));
    expect(sitemap.status).toBe(404);
  });

  it("never passes on a slug the client sent", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: null,
      isSubDomain: true,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
    });
    const res = await proxy(
      new NextRequest("https://abc.ecomsite.app/", {
        headers: {
          host: "abc.ecomsite.app",
          "x-ecomweb-preview-slug": "x3hm7wca",
        },
      })
    );
    expect(forwarded(res)).toBeNull();
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });

  it("hands a coming soon store's preview token to the render", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: "www.shop.vn",
      isSubDomain: true,
      suspended: false,
      externalUrl: null,
      previewSlug: "x3hm7wca",
      storePreviewToken: "sp.tok",
    });
    const res = await proxy(onPreviewHost("/products/a"));
    expect(forwardedToken(res)).toBe("sp.tok");
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://p-x3hm7wca.ecomsite.app/store/abc123/products/a"
    );
  });

  it("replaces a client-sent token with the lookup's own", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: "www.shop.vn",
      isSubDomain: true,
      suspended: false,
      externalUrl: null,
      previewSlug: "x3hm7wca",
      storePreviewToken: "sp.tok",
    });
    const res = await proxy(
      onPreviewHost("/products/a", {
        "x-ecomweb-store-preview-token": "forged",
      })
    );
    expect(forwardedToken(res)).toBe("sp.tok");
  });

  it("sends no token for an open store's preview host", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: "www.shop.vn",
      isSubDomain: true,
      suspended: false,
      externalUrl: null,
      previewSlug: "x3hm7wca",
      storePreviewToken: null,
    });
    const res = await proxy(onPreviewHost("/products/a"));
    expect(forwardedToken(res)).toBeNull();
    expect(forwarded(res)).toBe("x3hm7wca");
  });

  it("never passes on a token the client sent", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: null,
      isSubDomain: true,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
    });
    const res = await proxy(
      new NextRequest("https://abc.ecomsite.app/", {
        headers: {
          host: "abc.ecomsite.app",
          "x-ecomweb-store-preview-token": "forged",
        },
      })
    );
    expect(forwardedToken(res)).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toContain("/store/abc123");
  });
});

describe("proxy — /store/<ref> on the platform apex", () => {
  const onApex = (
    path: string,
    init: { host?: string; method?: string } = {}
  ) =>
    new NextRequest(`https://${init.host ?? "ecomsite.app"}${path}`, {
      method: init.method ?? "GET",
      headers: {
        host: init.host ?? "ecomsite.app",
        "x-forwarded-proto": "https",
      },
    });

  beforeEach(() => {
    getStoreByHost.mockReset();
    getStoreSubdomain.mockReset().mockResolvedValue("shop");
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  it("sends the shopper to the store's subdomain with the same path and query", async () => {
    const res = await proxy(onApex("/store/abc123/products/a?ref=x"));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://shop.ecomsite.app/products/a?ref=x"
    );
    expect(getStoreSubdomain).toHaveBeenCalledWith("abc123");
    expect(getStoreByHost).not.toHaveBeenCalled();
  });

  it("keeps a theme preview token across the hop", async () => {
    const res = await proxy(onApex("/store/abc123?preview_theme=tok"));
    expect(res.headers.get("location")).toBe(
      "https://shop.ecomsite.app/?preview_theme=tok"
    );
  });

  it("does the same on www, and keeps the method with 307", async () => {
    const res = await proxy(
      onApex("/store/abc123/api/auth/login", {
        host: "www.ecomsite.app",
        method: "POST",
      })
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "https://shop.ecomsite.app/api/auth/login"
    );
  });

  it("never renders the store on the apex when it has no subdomain", async () => {
    getStoreSubdomain.mockResolvedValue(null);
    const res = await proxy(onApex("/store/abc123/account"));
    expect(res.headers.get("location")).toBeNull();
    const rewrite = res.headers.get("x-middleware-rewrite") ?? "";
    expect(rewrite).toContain("/404");
    expect(rewrite).not.toContain("/store/");
  });

  it("fails closed when the lookup fails", async () => {
    getStoreSubdomain.mockRejectedValue(new Error("api down"));
    const res = await proxy(onApex("/store/abc123"));
    expect(res.headers.get("x-middleware-rewrite")).toContain("/404");
  });

  it("leaves the apex's own pages alone", async () => {
    const res = await proxy(onApex("/pricing"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(getStoreSubdomain).not.toHaveBeenCalled();
  });

  it("keeps path-based access on localhost", async () => {
    const res = await proxy(
      new NextRequest("http://localhost:3002/store/abc123/products/a", {
        headers: { host: "localhost:3002" },
      })
    );
    expect(res.headers.get("location")).toBeNull();
    expect(getStoreSubdomain).not.toHaveBeenCalled();
  });
});

describe("proxy — per-store traffic count", () => {
  beforeEach(() => {
    recordStoreRequest.mockReset();
    getStoreByHost.mockReset();
    getStoreSubdomain.mockReset().mockResolvedValue("shop");
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  it("counts a request to a store resolved by host", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: null,
      isSubDomain: true,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
    });
    await proxy(
      new NextRequest("https://shop.ecomsite.app/products/a", {
        headers: { host: "shop.ecomsite.app" },
      })
    );
    expect(recordStoreRequest).toHaveBeenCalledWith("abc123");
  });

  it("counts nothing for an unknown host or an apex redirect", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: null,
      domain: null,
      isSubDomain: false,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
    });
    await proxy(
      new NextRequest("https://nobody.example.com/", {
        headers: { host: "nobody.example.com" },
      })
    );
    await proxy(
      new NextRequest("https://ecomsite.app/store/abc123", {
        headers: { host: "ecomsite.app" },
      })
    );
    expect(recordStoreRequest).not.toHaveBeenCalled();
  });
});

describe("proxy — the store preview link's host", () => {
  beforeEach(() => {
    getStoreByHost.mockReset();
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  // A store host that resolved no store (coming soon, or the lookup failed)
  // still names one by its path, but the path form of the link belongs to
  // the shared host only; the store host takes `/preview?token=`.
  it("takes /store/<ref>/preview only on the shared host", async () => {
    for (const lookup of [
      () =>
        getStoreByHost.mockResolvedValue({
          storeRef: null,
          domain: null,
          isSubDomain: false,
          suspended: false,
          externalUrl: null,
          previewSlug: null,
          comingSoon: true,
          comingSoonName: "Tiệm Hoa",
          storePreviewToken: null,
        }),
      () => getStoreByHost.mockRejectedValue(new Error("api down")),
    ]) {
      lookup();
      const res = await proxy(
        new NextRequest(
          "https://shop.example.com/store/abc123/preview?token=tok",
          { headers: { host: "shop.example.com" } }
        )
      );
      expect(res.status).not.toBe(307);
      expect(res.headers.get("location")).toBeNull();
      expect(res.cookies.get("ecw_store_preview")).toBeUndefined();
    }
  });
});

describe("proxy — store preview in production (__Host- cookies)", () => {
  beforeEach(() => {
    getStoreByHost.mockReset().mockResolvedValue({
      storeRef: "abc123",
      domain: "shop.example.com",
      isSubDomain: false,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
      comingSoon: false,
      comingSoonName: null,
      storePreviewToken: null,
    });
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
    vi.stubEnv("NODE_ENV", "production");
  });

  afterEach(() => {
    // unstubAllEnvs also drops the file-level mode stub: put it back, so the
    // suites after this one never depend on running before it.
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
  });

  const onShop = (cookie: string) =>
    new NextRequest("https://shop.example.com/products/a", {
      headers: { host: "shop.example.com", cookie },
    });

  it("looks the host up with the __Host- cookie's token, noindex", async () => {
    const res = await proxy(onShop("__Host-ecw_store_preview=tok"));
    expect(getStoreByHost).toHaveBeenCalledWith("shop.example.com", {
      previewToken: "tok",
    });
    expect(res.headers.get("x-middleware-rewrite")).toBe(
      "https://shop.example.com/store/abc123/products/a"
    );
    expect(res.headers.get("x-robots-tag")).toBe("noindex");
  });

  it("never reads the bare name there (a sibling store could plant it)", async () => {
    const res = await proxy(onShop("ecw_store_preview=planted"));
    expect(getStoreByHost.mock.calls[0]).toEqual(["shop.example.com"]);
    expect(res.headers.get("x-robots-tag")).toBeNull();
  });
});

describe("proxy — internal headers on every request it lets through", () => {
  const INTERNAL = [
    "x-ecomweb-store-preview-token",
    "x-ecomweb-preview-slug",
    "x-ecomweb-served-store",
  ];
  const forged = Object.fromEntries(INTERNAL.map(name => [name, "forged"]));

  // The response's request-header override is there, and drops both.
  const expectStripped = (res: Response) => {
    const overridden = res.headers.get("x-middleware-override-headers");
    expect(overridden).not.toBeNull();
    for (const name of INTERNAL) {
      expect(overridden!.split(",")).not.toContain(name);
      expect(res.headers.get(`x-middleware-request-${name}`)).toBeNull();
    }
  };

  beforeEach(() => {
    getStoreByHost.mockReset();
    getStoreSubdomain.mockReset();
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  it("drops them on a metadata file served without a lookup", async () => {
    const res = await proxy(
      new NextRequest("https://shop.example.com/icon", {
        headers: { host: "shop.example.com", ...forged },
      })
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(getStoreByHost).not.toHaveBeenCalled();
    expectStripped(res);
  });

  it("drops them on robots.txt and sitemap.xml, on a store host and on localhost", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: "shop.example.com",
      isSubDomain: false,
      suspended: false,
      externalUrl: null,
      previewSlug: null,
    });
    for (const host of ["shop.example.com", "localhost:3002"]) {
      for (const path of ["/robots.txt", "/sitemap.xml"]) {
        const res = await proxy(
          new NextRequest(`http://${host}${path}`, {
            headers: { host, ...forged },
          })
        );
        expect(res.headers.get("x-middleware-next")).toBe("1");
        expectStripped(res);
      }
    }
  });

  it("drops them on robots.txt when the lookup fails", async () => {
    getStoreByHost.mockRejectedValue(new Error("api down"));
    const res = await proxy(
      new NextRequest("https://shop.example.com/robots.txt", {
        headers: { host: "shop.example.com", ...forged },
      })
    );
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expectStripped(res);
  });

  it("drops them on the 'domain not connected' rewrite", async () => {
    getStoreByHost.mockResolvedValue({
      storeRef: "abc123",
      domain: "shop.example.com",
      isSubDomain: false,
      suspended: false,
      externalUrl: "https://shop.example.com",
      previewSlug: null,
    });
    const res = await proxy(
      new NextRequest("https://shop.example.com/products/a", {
        headers: { host: "shop.example.com", ...forged },
      })
    );
    expect(res.headers.get("x-middleware-rewrite")).toContain(
      "/domain-not-connected"
    );
    expectStripped(res);
  });

  it("drops them on the apex's /404 rewrite", async () => {
    getStoreSubdomain.mockResolvedValue(null);
    const res = await proxy(
      new NextRequest("https://ecomsite.app/store/abc123", {
        headers: { host: "ecomsite.app", ...forged },
      })
    );
    expect(res.headers.get("x-middleware-rewrite")).toContain("/404");
    expectStripped(res);
  });
});

describe("proxy — the served-store stamp", () => {
  const stamp = (res: Response) =>
    res.headers.get("x-middleware-request-x-ecomweb-served-store");
  const resolved = (previewSlug: string | null = null) => ({
    storeRef: "abc",
    domain: null,
    isSubDomain: false,
    suspended: false,
    externalUrl: null,
    previewSlug,
  });

  beforeEach(() => {
    getStoreByHost.mockReset();
    lookupRedirect.mockReset().mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_DOMAIN_SUFFIX", "ecomsite.app");
  });

  // The backend proxy and auth routes trust the stamp only because the
  // middleware runs on them (and so strips a client copy) there.
  it("runs on the per-store proxy and auth routes, not on root /api", () => {
    const matches = (path: string) =>
      new RegExp(`^${config.matcher[0]}$`).test(path);
    expect(matches("/store/abc/api/backend/storefront/stores/abc/cart")).toBe(true);
    expect(matches("/store/abc/api/auth/login")).toBe(true);
    expect(matches("/api/auth/login")).toBe(false);
    expect(matches("/api/backend/storefront/stores/abc/cart")).toBe(false);
  });

  it("stamps the host's store on a store's proxied cart call, over a client copy", async () => {
    getStoreByHost.mockResolvedValue(resolved());
    const req = new NextRequest(
      "https://shop.test/store/abc/api/backend/storefront/stores/abc/cart",
      { headers: { host: "shop.test", "x-ecomweb-served-store": "evil" } }
    );
    const res = await proxy(req);
    expect(stamp(res)).toBe("abc");
    // Already under /store/abc: rewritten in place, not double-prefixed.
    expect(new URL(res.headers.get("x-middleware-rewrite") ?? "").pathname).toBe(
      "/store/abc/api/backend/storefront/stores/abc/cart"
    );
  });

  it("stamps the host's store and drops a client copy", async () => {
    getStoreByHost.mockResolvedValue(resolved());
    const req = new NextRequest("https://shop.test/store/other/api/backend/x", {
      headers: { host: "shop.test", "x-ecomweb-served-store": "evil" },
    });
    expect(stamp(await proxy(req))).toBe("abc");
  });

  it("stamps nothing when the host lookup fails", async () => {
    getStoreByHost.mockRejectedValueOnce(new Error("down"));
    const req = new NextRequest("https://shop.test/store/other/api/backend/x", {
      headers: { host: "shop.test", "x-ecomweb-served-store": "other" },
    });
    const res = await proxy(req);
    expect(stamp(res)).toBeNull();
    expect(res.headers.get("x-middleware-override-headers")).not.toContain(
      "x-ecomweb-served-store"
    );
  });

  it("stamps nothing when the host resolves to no store", async () => {
    getStoreByHost.mockResolvedValue({ ...resolved(), storeRef: null });
    const req = new NextRequest("https://shop.test/store/other/x", {
      headers: { host: "shop.test", "x-ecomweb-served-store": "other" },
    });
    expect(stamp(await proxy(req))).toBeNull();
  });

  it("stamps the path's store on localhost, over a client copy", async () => {
    const req = new NextRequest("http://localhost:3002/store/abc/api/backend/x", {
      headers: { host: "localhost:3002", "x-ecomweb-served-store": "evil" },
    });
    expect(stamp(await proxy(req))).toBe("abc");
    expect(getStoreByHost).not.toHaveBeenCalled();
  });

  it("stamps a preview host's store", async () => {
    getStoreByHost.mockResolvedValue(resolved("x3hm7wca"));
    const req = new NextRequest("https://p-x3hm7wca.ecomsite.app/products/a", {
      headers: { host: "p-x3hm7wca.ecomsite.app" },
    });
    expect(stamp(await proxy(req))).toBe("abc");
  });

  it("does not treat a look-alike host as path-based dev", async () => {
    getStoreByHost.mockResolvedValue({ ...resolved(), storeRef: null });
    const req = new NextRequest("https://mylocalhostshop.com/store/abc/x", {
      headers: { host: "mylocalhostshop.com" },
    });
    const res = await proxy(req);
    expect(getStoreByHost).toHaveBeenCalled();
    expect(stamp(res)).toBeNull();
  });

  it("stamps the host's store on a look-alike host, not the path's", async () => {
    getStoreByHost.mockResolvedValue(resolved());
    const req = new NextRequest("https://127.0.0.1.evil.test/store/other/x", {
      headers: { host: "127.0.0.1.evil.test" },
    });
    expect(stamp(await proxy(req))).toBe("abc");
  });

  it("never stamps the path's store on localhost in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    getStoreByHost.mockRejectedValue(new Error("no host mapping"));
    const req = new NextRequest("http://localhost:3002/store/abc/api/backend/x", {
      headers: { host: "localhost:3002", "x-ecomweb-served-store": "abc" },
    });
    const res = await proxy(req);
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_ECOMWEB_MODE", "multi");
    expect(stamp(res)).toBeNull();
  });
});
