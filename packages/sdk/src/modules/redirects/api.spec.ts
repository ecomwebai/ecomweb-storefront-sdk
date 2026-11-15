import { describe, expect, it, vi } from "vitest";
import { RedirectsApi } from "./api";

describe("RedirectsApi.lookup", () => {
  const redirect = { destination_path: "/new", redirect_type: 301 };
  const get = vi.fn(async () => ({ success: true, data: { data: redirect } }));
  const url = "/public/stores/abc/url-redirects/lookup?path=%2Fold";

  it("calls the client with the URL only when no request options are given", async () => {
    get.mockClear();
    await expect(
      new RedirectsApi({ get } as any).lookup("abc", "/old")
    ).resolves.toEqual(redirect);
    expect(get).toHaveBeenCalledWith(url);
    expect(get.mock.calls[0]).toHaveLength(1);
  });

  it("passes request options through when given", async () => {
    get.mockClear();
    await new RedirectsApi({ get } as any).lookup("abc", "/old", {
      skipStorePreview: true,
    });
    expect(get).toHaveBeenCalledWith(url, { skipStorePreview: true });
  });
});
