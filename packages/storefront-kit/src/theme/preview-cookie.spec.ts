import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { applyThemePreview, THEME_PREVIEW_COOKIE } from "./preview-cookie";

describe("applyThemePreview", () => {
  it("moves the token into an httpOnly cookie and redirects to the clean URL", () => {
    const res = applyThemePreview(
      new NextRequest("http://shop.test/products/a?preview_theme=tok.sig&x=1"),
      "/"
    )!;
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://shop.test/products/a?x=1");
    const cookie = res.cookies.get(THEME_PREVIEW_COOKIE)!;
    expect(cookie.value).toBe("tok.sig");
    expect(cookie.httpOnly).toBe(true);
    expect(cookie.path).toBe("/");
    expect(cookie.maxAge).toBe(24 * 60 * 60);
  });

  it("clears the cookie on preview_theme=exit", () => {
    const res = applyThemePreview(
      new NextRequest("http://shop.test/?preview_theme=exit"),
      "/store/abc"
    )!;
    expect(res.cookies.get(THEME_PREVIEW_COOKIE)?.value).toBe("");
    expect(res.cookies.get(THEME_PREVIEW_COOKIE)?.path).toBe("/store/abc");
  });

  it("does nothing without the param", () => {
    expect(
      applyThemePreview(new NextRequest("http://shop.test/"), "/")
    ).toBeNull();
  });

  it("refuses an oversized token rather than storing it", () => {
    const res = applyThemePreview(
      new NextRequest(`http://shop.test/?preview_theme=${"a".repeat(3000)}`),
      "/"
    )!;
    expect(res.cookies.get(THEME_PREVIEW_COOKIE)?.value).toBe("");
  });
});

describe("applyThemePreview in production", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("sets a partitioned SameSite=None cookie, so the theme editor's frame keeps it", () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = applyThemePreview(
      new NextRequest("https://shop.test/?preview_theme=tok"),
      "/"
    )!;
    const header = res.headers.get("set-cookie")!;
    expect(header).toMatch(/SameSite=none/i);
    expect(header).toMatch(/Secure/);
    expect(header).toMatch(/Partitioned/);
  });

  it("takes the __Host- name at Path=/, and keeps the bare one on a scoped path", () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = new NextRequest("https://shop.test/?preview_theme=tok");
    expect(
      applyThemePreview(req, "/")!.cookies.get(`__Host-${THEME_PREVIEW_COOKIE}`)
        ?.value
    ).toBe("tok");
    expect(
      applyThemePreview(req, "/store/abc")!.cookies.get(THEME_PREVIEW_COOKIE)
        ?.value
    ).toBe("tok");
  });

  it("stays SameSite=Lax locally", () => {
    const res = applyThemePreview(
      new NextRequest("http://shop.test/?preview_theme=tok"),
      "/"
    )!;
    expect(res.headers.get("set-cookie")).toMatch(/SameSite=lax/i);
  });
});

describe("applyThemePreview behind a proxy", () => {
  it("redirects to the public origin, not the internal one", () => {
    const req = new NextRequest("http://10.0.0.5:3000/?preview_theme=t", {
      headers: {
        "x-forwarded-host": "shop.example.com",
        "x-forwarded-proto": "https",
      },
    });
    expect(applyThemePreview(req, "/")!.headers.get("location")).toBe(
      "https://shop.example.com/"
    );
  });
});
