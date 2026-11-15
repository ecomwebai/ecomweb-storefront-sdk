import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { StoresApi } from "./api";
import type { PublishedStoreTheme, StoreByDomainInfo } from "./types";

describe("published store theme", () => {
  it("an external theme carries its hosting and URL", () => {
    const theme: PublishedStoreTheme = {
      id: "9",
      name: "Next site",
      kind: "external",
      hosting: "external",
      external_url: "https://shop.example.com",
      source_theme_id: "default",
      values: {},
    };
    expect(theme.kind).toBe("external");
    expect(theme.external_url).toBe("https://shop.example.com");
  });

  it("an Ecomweb theme from an older API has neither field", () => {
    const theme: PublishedStoreTheme = {
      id: null,
      name: "Default",
      kind: "hosted",
      source_theme_id: "default",
      values: {},
    };
    expect(theme.hosting).toBeUndefined();
    expectTypeOf<PublishedStoreTheme["kind"]>().toEqualTypeOf<
      "hosted" | "custom" | "external"
    >();
    expectTypeOf<PublishedStoreTheme["hosting"]>().toEqualTypeOf<
      "ecomweb" | "external" | undefined
    >();
  });
});

describe("StoresApi.getByDomain", () => {
  it("passes the storefront URL through when the live theme is external", async () => {
    const get = vi.fn(async () => ({
      success: true,
      data: { ref: "abc", storefront_url: "https://shop.example.com" },
    }));
    const store = await new StoresApi({ get } as any).getByDomain("abc");
    expect(get).toHaveBeenCalledWith("/public/stores/domain/abc");
    expect(store?.storefront_url).toBe("https://shop.example.com");
    expectTypeOf(store).toEqualTypeOf<StoreByDomainInfo | null>();
    expectTypeOf<StoreByDomainInfo["storefront_url"]>().toEqualTypeOf<
      string | null | undefined
    >();
  });

  it("passes request options (a preview header) through when given", async () => {
    const get = vi.fn(async () => ({
      success: true,
      data: { ref: "abc", store_preview_token: "sp.tok" },
    }));
    const store = await new StoresApi({ get } as any).getByDomain("abc", {
      headers: { "x-store-preview": "t" },
    });
    expect(get).toHaveBeenCalledWith("/public/stores/domain/abc", {
      headers: { "x-store-preview": "t" },
    });
    expect(store?.store_preview_token).toBe("sp.tok");
    expectTypeOf<StoreByDomainInfo["store_preview_token"]>().toEqualTypeOf<
      string | null | undefined
    >();
  });
});

describe("StoresApi.getById", () => {
  const ok = vi.fn(async () => ({ success: true, data: { ref: "abc" } }));
  const url =
    "/public/stores/abc?include_config=1&include_settings=1&include_embedded_scripts=1";

  it("calls the client with the URL only when no request options are given", async () => {
    ok.mockClear();
    await new StoresApi({ get: ok } as any).getById("abc");
    expect(ok).toHaveBeenCalledWith(url);
    expect(ok.mock.calls[0]).toHaveLength(1);
  });

  it("passes request options through when given", async () => {
    ok.mockClear();
    const store = await new StoresApi({ get: ok } as any).getById(
      "abc",
      { includeSettings: false, includeEmbeddedScripts: false },
      { skipStorePreview: true }
    );
    expect(ok).toHaveBeenCalledWith("/public/stores/abc?include_config=1", {
      skipStorePreview: true,
    });
    expect(store?.ref).toBe("abc");
  });
});
