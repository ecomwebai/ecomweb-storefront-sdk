import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  publicList: vi.fn(),
  publicGet: vi.fn(),
  customerList: vi.fn(),
  customerGet: vi.fn(),
  createStoreSdk: vi.fn(),
}));

vi.mock("../sdk", () => ({
  sdk: { metaobjects: { list: mocks.publicList, get: mocks.publicGet } },
  createStoreSdk: mocks.createStoreSdk,
}));

import { getMetaobject, getMetaobjects } from "./metaobjects";

const entry = {
  type: "feedbacks",
  handle: "lan-anh",
  display_name: "Lan Anh",
  fields: { name: { type: "single_line_text", value: "Lan Anh" } },
  updated_at: "2026-10-05T10:00:00Z",
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.createStoreSdk.mockReturnValue({
    metaobjects: { list: mocks.customerList, get: mocks.customerGet },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("as_customer on the server", () => {
  it("rejects with an actionable error before any request", async () => {
    vi.stubGlobal("window", undefined);
    await expect(
      getMetaobjects("s1", "perks", { as_customer: true })
    ).rejects.toThrow(/as_customer reads need the browser/);
    await expect(
      getMetaobject("s1", "perks", "gold", { as_customer: true })
    ).rejects.toThrow(/client component/);
    expect(mocks.createStoreSdk).not.toHaveBeenCalled();
    expect(mocks.customerList).not.toHaveBeenCalled();
  });
});

describe("getMetaobjects", () => {
  it("lists through the public sdk with filter, cursor and limit", async () => {
    const page = { items: [entry], next_cursor: "c2" };
    mocks.publicList.mockResolvedValue(page);

    const result = await getMetaobjects("s1", "feedbacks", {
      filter: { rating: 5 },
      cursor: "c1",
      limit: 10,
    });

    expect(result).toBe(page);
    expect(mocks.publicList).toHaveBeenCalledWith("s1", "feedbacks", {
      filter: { rating: 5 },
      cursor: "c1",
      limit: 10,
    });
    expect(mocks.createStoreSdk).not.toHaveBeenCalled();
  });

  it("defaults the options to an empty object", async () => {
    mocks.publicList.mockResolvedValue({ items: [], next_cursor: null });
    await getMetaobjects("s1", "feedbacks");
    expect(mocks.publicList).toHaveBeenCalledWith("s1", "feedbacks", {});
  });

  it("uses the store-scoped sdk for a customer read", async () => {
    mocks.customerList.mockResolvedValue({ items: [], next_cursor: null });

    vi.stubGlobal("window", {});
    await getMetaobjects("s1", "perks", { as_customer: true });

    expect(mocks.createStoreSdk).toHaveBeenCalledWith("s1");
    expect(mocks.customerList).toHaveBeenCalledWith("s1", "perks", {
      as_customer: true,
    });
    expect(mocks.publicList).not.toHaveBeenCalled();
  });
});

describe("getMetaobject", () => {
  it("gets one entry by handle through the public sdk", async () => {
    mocks.publicGet.mockResolvedValue(entry);
    expect(await getMetaobject("s1", "feedbacks", "lan-anh")).toBe(entry);
    expect(mocks.publicGet).toHaveBeenCalledWith(
      "s1",
      "feedbacks",
      "lan-anh",
      {}
    );
  });

  it("passes null through for a missing or hidden entry", async () => {
    mocks.publicGet.mockResolvedValue(null);
    expect(await getMetaobject("s1", "feedbacks", "nobody")).toBeNull();
  });

  it("uses the store-scoped sdk for a customer read", async () => {
    mocks.customerGet.mockResolvedValue(entry);
    vi.stubGlobal("window", {});
    await getMetaobject("s1", "perks", "gold", { as_customer: true });
    expect(mocks.createStoreSdk).toHaveBeenCalledWith("s1");
    expect(mocks.customerGet).toHaveBeenCalledWith("s1", "perks", "gold", {
      as_customer: true,
    });
    expect(mocks.publicGet).not.toHaveBeenCalled();
  });
});
