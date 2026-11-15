import { describe, it, expect } from "vitest";
import { readBasicSettings, resolveLegalHref } from "./basic-settings";

describe("readBasicSettings", () => {
  it("reads the legal links from settings.legal_links", () => {
    expect(
      readBasicSettings({
        settings: { legal_links: { terms: "/pages/t", privacy: " " } },
      })
    ).toEqual({ legalLinks: { termsLink: "/pages/t", policyLink: null } });
  });

  it("never reads theme_config (themes P5)", () => {
    const s = readBasicSettings({
      settings: {},
      theme_config: { checkout: { term_link: "/old", policy_link: "/old" } },
    } as never);
    expect(s.legalLinks).toEqual({ termsLink: null, policyLink: null });
  });

  it("tolerates missing settings entirely", () => {
    expect(readBasicSettings({}).legalLinks).toEqual({
      termsLink: null,
      policyLink: null,
    });
  });
});

describe("resolveLegalHref", () => {
  const toUrl = (p: string) => `/base${p}`;
  it("keeps absolute links", () => {
    expect(resolveLegalHref("https://x.io/p", null, toUrl)).toBe(
      "https://x.io/p"
    );
  });
  it("prefixes relative links with or without a leading slash", () => {
    expect(resolveLegalHref("/pages/t", null, toUrl)).toBe("/base/pages/t");
    expect(resolveLegalHref("pages/t", null, toUrl)).toBe("/base/pages/t");
  });
  it("uses the fallback path, or # with no fallback", () => {
    expect(resolveLegalHref(null, "/pages/terms-of-service", toUrl)).toBe(
      "/base/pages/terms-of-service"
    );
    expect(resolveLegalHref(null, null, toUrl)).toBe("#");
  });
});
