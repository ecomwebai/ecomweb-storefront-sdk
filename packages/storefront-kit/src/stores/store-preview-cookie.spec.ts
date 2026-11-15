import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  applyStorePreview,
  skipsStorePreview,
  SKIP_STORE_PREVIEW,
  STORE_PREVIEW_COOKIE,
  STORE_PREVIEW_HEADER,
  STORE_PREVIEW_PARAM,
  STORE_PREVIEW_PATH,
  STORE_PREVIEW_TOKEN_HEADER,
  storePreviewCookieName,
  storePreviewTokenFrom,
  firstLivePreviewToken,
  previewTokenUnexpired,
} from "./store-preview-cookie";

/** A cookie jar shaped like `cookies()` / `request.cookies`. */
function jarOf(values: Record<string, string>) {
  return {
    get: (name: string) =>
      name in values ? { value: values[name]! } : undefined,
  };
}

function requestWith(headers: Record<string, string> = {}) {
  return { headers: new Headers(headers) };
}

describe("store preview constants", () => {
  it("are the contract's names", () => {
    expect(STORE_PREVIEW_COOKIE).toBe("ecw_store_preview");
    expect(STORE_PREVIEW_PATH).toBe("/preview");
    expect(STORE_PREVIEW_PARAM).toBe("token");
    expect(STORE_PREVIEW_HEADER).toBe("x-store-preview");
    expect(STORE_PREVIEW_TOKEN_HEADER).toBe("x-ecomweb-store-preview-token");
  });
});

describe("applyStorePreview", () => {
  it("moves the token into an httpOnly lax cookie and redirects to the store root", () => {
    const res = applyStorePreview(
      new NextRequest("http://shop.test/preview?token=tok.sig"),
      "/",
      "/"
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://shop.test/");
    const cookie = res.cookies.get(STORE_PREVIEW_COOKIE)!;
    expect(cookie.value).toBe("tok.sig");
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe("/");
    expect(cookie.maxAge).toBe(86400);
    expect(cookie.sameSite).toBe("lax");
  });

  it("scopes the cookie to a path-based store and redirects to its root", () => {
    const res = applyStorePreview(
      new NextRequest("http://localhost:3002/store/abc/preview?token=t"),
      "/store/abc",
      "/store/abc"
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3002/store/abc");
    expect(res.cookies.get(STORE_PREVIEW_COOKIE)?.value).toBe("t");
    expect(res.cookies.get(STORE_PREVIEW_COOKIE)?.path).toBe("/store/abc");
  });

  it("drops any other query params from the redirect", () => {
    const res = applyStorePreview(
      new NextRequest("http://shop.test/preview?token=t&utm=x"),
      "/",
      "/"
    );
    expect(res.headers.get("location")).toBe("http://shop.test/");
  });

  it.each([
    ["an empty token", "http://shop.test/preview?token="],
    ["no token", "http://shop.test/preview"],
    [
      "an oversized token",
      `http://shop.test/preview?token=${"a".repeat(3000)}`,
    ],
  ])(
    "clears the cookie for %s and still redirects to the store root",
    (_, url) => {
      const res = applyStorePreview(new NextRequest(url), "/", "/");
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://shop.test/");
      const cookie = res.cookies.get(STORE_PREVIEW_COOKIE)!;
      expect(cookie.value).toBe("");
      expect(cookie.maxAge).toBe(0);
    }
  );

  it("keeps a token of exactly 2048 characters", () => {
    const token = "a".repeat(2048);
    const res = applyStorePreview(
      new NextRequest(`http://shop.test/preview?token=${token}`),
      "/",
      "/"
    );
    expect(res.cookies.get(STORE_PREVIEW_COOKIE)?.value).toBe(token);
    expect(res.cookies.get(STORE_PREVIEW_COOKIE)?.maxAge).toBe(86400);
  });
});

describe("store preview cookie in production", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("takes the __Host- name at Path=/, and keeps the bare one on a scoped path", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(storePreviewCookieName("/")).toBe("__Host-ecw_store_preview");
    expect(storePreviewCookieName("/store/abc")).toBe("ecw_store_preview");
  });

  it("writes a Secure __Host- cookie on a host-mapped store", () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = applyStorePreview(
      new NextRequest("https://shop.test/preview?token=tok"),
      "/",
      "/"
    );
    const cookie = res.cookies.get("__Host-ecw_store_preview")!;
    expect(cookie.value).toBe("tok");
    expect(cookie.secure).toBe(true);
    expect(cookie.sameSite).toBe("lax");
  });

  it("reads __Host-ecw_store_preview on a host-mapped request and ignores the bare name", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      storePreviewTokenFrom(
        jarOf({ "__Host-ecw_store_preview": "host.tok" }),
        requestWith({ "x-ecomweb-host-mapped": "1" })
      )
    ).toBe("host.tok");
    expect(
      storePreviewTokenFrom(
        jarOf({ ecw_store_preview: "planted" }),
        requestWith({ "x-ecomweb-host-mapped": "1" })
      )
    ).toBeNull();
  });

  it("reads __Host-ecomweb_theme_preview on a host-mapped request and ignores the bare name", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(
      storePreviewTokenFrom(
        jarOf({ "__Host-ecomweb_theme_preview": "theme.tok" }),
        requestWith({ "x-ecomweb-host-mapped": "1" })
      )
    ).toBe("theme.tok");
    expect(
      storePreviewTokenFrom(
        jarOf({ ecomweb_theme_preview: "planted" }),
        requestWith({ "x-ecomweb-host-mapped": "1" })
      )
    ).toBeNull();
  });
});

describe("storePreviewTokenFrom", () => {
  it("reads the store preview cookie on a host-mapped request", () => {
    const jar = jarOf({ ecw_store_preview: "tok" });
    expect(
      storePreviewTokenFrom(jar, requestWith({ "x-ecomweb-host-mapped": "1" }))
    ).toBe("tok");
    expect(storePreviewTokenFrom(jar, requestWith())).toBe("tok");
  });

  it("reads the store preview cookie on the shared path-based host", () => {
    expect(
      storePreviewTokenFrom(
        jarOf({ ecw_store_preview: "tok" }),
        requestWith({ "x-ecomweb-host-mapped": "0" })
      )
    ).toBe("tok");
  });

  it("is null for an empty cookie and for a missing one", () => {
    expect(
      storePreviewTokenFrom(jarOf({ ecw_store_preview: "" }), requestWith())
    ).toBeNull();
    expect(storePreviewTokenFrom(jarOf({}), requestWith())).toBeNull();
  });

  it("prefers the preview host's token header over the cookie", () => {
    const header = { "x-ecomweb-store-preview-token": "host-tok" };
    expect(storePreviewTokenFrom(jarOf({}), requestWith(header))).toBe(
      "host-tok"
    );
    expect(
      storePreviewTokenFrom(
        jarOf({ ecw_store_preview: "tok" }),
        requestWith(header)
      )
    ).toBe("host-tok");
  });

  it("falls back to the cookie when the token header is empty", () => {
    expect(
      storePreviewTokenFrom(
        jarOf({ ecw_store_preview: "tok" }),
        requestWith({ "x-ecomweb-store-preview-token": "" })
      )
    ).toBe("tok");
  });

  describe("theme preview fallback", () => {
    it("uses the theme preview cookie when there is no store preview token", () => {
      expect(
        storePreviewTokenFrom(
          jarOf({ ecomweb_theme_preview: "theme.tok" }),
          requestWith()
        )
      ).toBe("theme.tok");
    });

    it("prefers the store preview cookie over the theme preview cookie", () => {
      expect(
        storePreviewTokenFrom(
          jarOf({
            ecw_store_preview: "tok",
            ecomweb_theme_preview: "theme.tok",
          }),
          requestWith()
        )
      ).toBe("tok");
    });

    it("prefers the preview host's token header over the theme preview cookie", () => {
      expect(
        storePreviewTokenFrom(
          jarOf({ ecomweb_theme_preview: "theme.tok" }),
          requestWith({ "x-ecomweb-store-preview-token": "host-tok" })
        )
      ).toBe("host-tok");
    });

    it("is null for an empty theme preview cookie", () => {
      expect(
        storePreviewTokenFrom(
          jarOf({ ecw_store_preview: "", ecomweb_theme_preview: "" }),
          requestWith()
        )
      ).toBeNull();
    });
  });
});

describe("skipsStorePreview", () => {
  it("is true only for request options carrying SKIP_STORE_PREVIEW", () => {
    expect(SKIP_STORE_PREVIEW).toEqual({ skipStorePreview: true });
    expect(skipsStorePreview(SKIP_STORE_PREVIEW)).toBe(true);
    expect(
      skipsStorePreview({ ...SKIP_STORE_PREVIEW, headers: { a: "b" } })
    ).toBe(true);
    expect(skipsStorePreview({})).toBe(false);
    expect(skipsStorePreview(undefined)).toBe(false);
    expect(skipsStorePreview({ skipStorePreview: "yes" })).toBe(false);
  });
});

/** A token shaped like the API's: base64url(json).signature. */
function tokenExpiring(exp: number, sig = "sig") {
  return `${Buffer.from(JSON.stringify({ k: "store", s: 1, exp })).toString("base64url")}.${sig}`;
}

describe("expired preview tokens", () => {
  const live = tokenExpiring(Date.now() + 60_000, "live");
  const dead = tokenExpiring(Date.now() - 60_000, "dead");

  it("reads exp from the payload and treats unreadable tokens as live", () => {
    expect(previewTokenUnexpired(live)).toBe(true);
    expect(previewTokenUnexpired(dead)).toBe(false);
    expect(previewTokenUnexpired("opaque")).toBe(true);
  });

  it("prefers the first live token", () => {
    expect(firstLivePreviewToken(dead, live)).toBe(live);
    expect(firstLivePreviewToken(null, "", live)).toBe(live);
  });

  it("falls back to the first present token when all are expired, null when none", () => {
    expect(firstLivePreviewToken(dead, null)).toBe(dead);
    expect(firstLivePreviewToken(null, undefined, "")).toBeNull();
  });

  it("lets a valid theme cookie win over a stale store cookie", () => {
    expect(
      storePreviewTokenFrom(
        jarOf({ ecw_store_preview: dead, ecomweb_theme_preview: live }),
        requestWith()
      )
    ).toBe(live);
  });

  it("keeps the store cookie first when both are live", () => {
    const other = tokenExpiring(Date.now() + 90_000, "other");
    expect(
      storePreviewTokenFrom(
        jarOf({ ecw_store_preview: live, ecomweb_theme_preview: other }),
        requestWith()
      )
    ).toBe(live);
  });
});
