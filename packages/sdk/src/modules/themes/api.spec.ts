import { describe, expect, it, vi } from "vitest";
import { ThemesApi } from "./api";

describe("ThemesApi.getPreview", () => {
  it("asks the store's preview endpoint with the token, URL-encoded", async () => {
    const get = vi.fn(async () => ({
      success: true,
      data: {
        id: "3",
        name: "S",
        kind: "hosted",
        source_theme_id: "default",
        values: {},
      },
    }));
    const api = new ThemesApi({ get } as any);
    const theme = await api.getPreview("abc", "a.b+c");
    expect(get).toHaveBeenCalledWith(
      "/public/stores/abc/theme-preview?token=a.b%2Bc"
    );
    expect(theme?.name).toBe("S");
  });

  it("returns null when the API refuses the token", async () => {
    const api = new ThemesApi({
      get: vi.fn(async () => ({
        success: false,
        error: { statusCode: 401, error: "THEME_PREVIEW_INVALID" },
      })),
    } as any);
    expect(await api.getPreview("abc", "bad")).toBeNull();
  });
});

describe("ThemesApi.getPreview, other refusals", () => {
  it("treats a disabled preview (503) as no preview, but still throws on a server error", async () => {
    const off = new ThemesApi({
      get: vi.fn(async () => ({ success: false, error: { statusCode: 503 } })),
    } as any);
    expect(await off.getPreview("abc", "t")).toBeNull();
    const broken = new ThemesApi({
      get: vi.fn(async () => ({ success: false, error: { statusCode: 500 } })),
    } as any);
    await expect(broken.getPreview("abc", "t")).rejects.toThrow();
  });
});
