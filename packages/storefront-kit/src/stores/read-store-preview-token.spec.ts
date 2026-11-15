import { beforeEach, describe, expect, it, vi } from "vitest";
import { readStorePreviewToken } from "./read-store-preview-token";

const nextHeaders = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
}));
vi.mock("next/headers", () => nextHeaders);

const jar = (values: Record<string, string>) => ({
  get: (name: string) =>
    name in values ? { value: values[name]! } : undefined,
});

describe("readStorePreviewToken", () => {
  beforeEach(() => {
    nextHeaders.headers.mockResolvedValue(new Headers());
  });

  it("reads the store preview cookie", async () => {
    nextHeaders.cookies.mockResolvedValue(jar({ ecw_store_preview: "tok" }));
    await expect(readStorePreviewToken()).resolves.toBe("tok");
  });

  it("prefers a preview host's token the middleware stamped", async () => {
    nextHeaders.cookies.mockResolvedValue(jar({ ecw_store_preview: "tok" }));
    nextHeaders.headers.mockResolvedValue(
      new Headers({ "x-ecomweb-store-preview-token": "sp.tok" })
    );
    await expect(readStorePreviewToken()).resolves.toBe("sp.tok");
  });

  it("falls back to the theme preview cookie", async () => {
    nextHeaders.cookies.mockResolvedValue(
      jar({ ecomweb_theme_preview: "theme.tok" })
    );
    await expect(readStorePreviewToken()).resolves.toBe("theme.tok");
  });

  it("is null with neither", async () => {
    nextHeaders.cookies.mockResolvedValue(jar({}));
    await expect(readStorePreviewToken()).resolves.toBeNull();
  });
});
