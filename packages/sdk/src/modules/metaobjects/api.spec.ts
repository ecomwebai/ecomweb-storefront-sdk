import { describe, expect, it, vi } from "vitest";
import { MetaobjectsApi } from "./api";

const entry = {
  type: "feedbacks",
  handle: "lan-anh",
  display_name: "Lan Anh",
  fields: { name: { type: "single_line_text", value: "Lan Anh" } },
  updated_at: "2026-10-05T10:00:00Z",
};

function clients() {
  const publicGet = vi.fn(async () => ({ success: true, data: { items: [entry], next_cursor: "c2" } }));
  const authGet = vi.fn(async () => ({ success: true, data: { items: [], next_cursor: null } }));
  return {
    publicGet,
    authGet,
    api: new MetaobjectsApi({ get: publicGet } as any, { get: authGet } as any),
  };
}

describe("MetaobjectsApi.list", () => {
  it("encodes filters, cursor and limit on the public route", async () => {
    const { api, publicGet } = clients();
    const result = await api.list("abc", "feedbacks", {
      filter: { rating: 5, featured: true },
      cursor: "c1",
      limit: 20,
    });
    expect(publicGet).toHaveBeenCalledWith(
      "/public/stores/abc/metaobjects/feedbacks?filter%5Brating%5D=5&filter%5Bfeatured%5D=true&cursor=c1&limit=20"
    );
    expect(result).toEqual({ items: [entry], next_cursor: "c2" });
  });

  it("uses the customer session when asked", async () => {
    const { api, authGet, publicGet } = clients();
    await api.list("abc", "perks", { as_customer: true });
    expect(authGet).toHaveBeenCalledWith("/public/stores/abc/metaobjects/perks");
    expect(publicGet).not.toHaveBeenCalled();
  });

  it("lists a hidden or unknown type as empty", async () => {
    const api = new MetaobjectsApi(
      { get: vi.fn(async () => ({ success: false, error: { statusCode: 404 } })) } as any,
      {} as any
    );
    expect(await api.list("abc", "secret")).toEqual({ items: [], next_cursor: null });
  });

  it("still throws on a server error", async () => {
    const api = new MetaobjectsApi(
      { get: vi.fn(async () => ({ success: false, error: { statusCode: 500, message: "x" } })) } as any,
      {} as any
    );
    await expect(api.list("abc", "feedbacks")).rejects.toThrow();
  });
});

describe("MetaobjectsApi.get", () => {
  it("fetches one entry by handle, encoding both segments", async () => {
    const get = vi.fn(async () => ({ success: true, data: entry }));
    const api = new MetaobjectsApi({ get } as any, {} as any);
    expect(await api.get("abc", "feedbacks", "lan-anh")).toEqual(entry);
    expect(get).toHaveBeenCalledWith("/public/stores/abc/metaobjects/feedbacks/lan-anh");
  });

  it("returns null for a missing entry", async () => {
    const api = new MetaobjectsApi(
      { get: vi.fn(async () => ({ success: false, error: { statusCode: 404 } })) } as any,
      {} as any
    );
    expect(await api.get("abc", "feedbacks", "nobody")).toBeNull();
  });

  it("encodes type and handle path segments", async () => {
    const get = vi.fn(async () => ({ success: true, data: entry }));
    const api = new MetaobjectsApi({ get } as any, {} as any);
    await api.get("abc", "my type", "a b/c");
    expect(get).toHaveBeenCalledWith("/public/stores/abc/metaobjects/my%20type/a%20b%2Fc");
  });

  it("uses the customer session when asked", async () => {
    const authGet = vi.fn(async () => ({ success: true, data: entry }));
    const publicGet = vi.fn();
    const api = new MetaobjectsApi({ get: publicGet } as any, { get: authGet } as any);
    expect(await api.get("abc", "perks", "gold", { as_customer: true })).toEqual(entry);
    expect(authGet).toHaveBeenCalledWith("/public/stores/abc/metaobjects/perks/gold");
    expect(publicGet).not.toHaveBeenCalled();
  });

  it("still throws on a server error", async () => {
    const api = new MetaobjectsApi(
      { get: vi.fn(async () => ({ success: false, error: { statusCode: 500, message: "x" } })) } as any,
      {} as any
    );
    await expect(api.get("abc", "feedbacks", "lan-anh")).rejects.toThrow();
  });
});
