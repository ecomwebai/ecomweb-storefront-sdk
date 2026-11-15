import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import {
  clearAuthCookies,
  hostOnlyCookieName,
  oauthNonceCookieName,
  readAuthCookies,
  writeAuthCookies,
} from "./cookies";

const tokens = { access_token: "at", refresh_token: "rt" };

function jar(cookie: string) {
  return new NextRequest("https://shop.test/", { headers: { cookie } }).cookies;
}

describe("hostOnlyCookieName", () => {
  it("prefixes only a Secure cookie at Path=/", () => {
    expect(hostOnlyCookieName("c", "/", true)).toBe("__Host-c");
    expect(hostOnlyCookieName("c", "/store/abc", true)).toBe("c");
    expect(hostOnlyCookieName("c", "/", false)).toBe("c");
  });
});

describe("auth cookies in production", () => {
  beforeEach(() => vi.stubEnv("NODE_ENV", "production"));
  afterEach(() => vi.unstubAllEnvs());

  it("writes __Host- names at Path=/", () => {
    const res = NextResponse.next();
    writeAuthCookies(res, "abc", tokens, "/");
    const header = res.headers.get("set-cookie")!;
    expect(header).toContain("__Host-ecomweb_sf_abc_at=at; Path=/");
    expect(header).toContain("__Host-ecomweb_sf_abc_rt=rt; Path=/");
    expect(header).toMatch(/Secure/);
    expect(header).not.toMatch(/Domain=/i);
  });

  it("keeps the bare names on a scoped path, which cannot take the prefix", () => {
    const res = NextResponse.next();
    writeAuthCookies(res, "abc", tokens, "/store/abc");
    expect(res.cookies.get("ecomweb_sf_abc_at")?.path).toBe("/store/abc");
  });

  it("ignores bare names at Path=/: any sibling store can set those", () => {
    const tossed = "ecomweb_sf_abc_at=evil; ecomweb_sf_abc_rt=evil";
    expect(readAuthCookies(jar(tossed), "abc", "/")).toBeNull();
    expect(
      readAuthCookies(
        jar(
          `${tossed}; __Host-ecomweb_sf_abc_at=at; __Host-ecomweb_sf_abc_rt=rt`
        ),
        "abc",
        "/"
      )
    ).toEqual(tokens);
  });

  it("logout clears the session at both paths and the pre-prefix names", () => {
    const res = NextResponse.next();
    clearAuthCookies(res, "abc", "/");
    const cleared = res.headers
      .getSetCookie()
      .map(c => c.split(";").slice(0, 2).join(";"));
    expect(cleared).toEqual(
      expect.arrayContaining([
        "__Host-ecomweb_sf_abc_at=; Path=/",
        "__Host-ecomweb_sf_abc_rt=; Path=/",
        "ecomweb_sf_abc_at=; Path=/store/abc",
        "ecomweb_sf_abc_rt=; Path=/store/abc",
        "ecomweb_sf_abc_at=; Path=/",
        "ecomweb_sf_abc_rt=; Path=/",
      ])
    );
  });

  it("names the OAuth nonce the same way", () => {
    expect(oauthNonceCookieName("abc", "/")).toBe(
      "__Host-ecomweb_sf_abc_oauth"
    );
    expect(oauthNonceCookieName("abc", "/store/abc")).toBe(
      "ecomweb_sf_abc_oauth"
    );
  });
});

describe("auth cookies in local dev", () => {
  it("keeps the bare names, since __Host- needs Secure (https)", () => {
    const res = NextResponse.next();
    writeAuthCookies(res, "abc", tokens, "/");
    expect(res.cookies.get("ecomweb_sf_abc_at")?.value).toBe("at");
    expect(
      readAuthCookies(
        jar("ecomweb_sf_abc_at=at; ecomweb_sf_abc_rt=rt"),
        "abc",
        "/"
      )
    ).toEqual(tokens);
  });

  it("logout clears both paths and nothing else", () => {
    const res = NextResponse.next();
    clearAuthCookies(res, "abc", "/");
    expect(res.headers.getSetCookie()).toHaveLength(4);
  });
});
