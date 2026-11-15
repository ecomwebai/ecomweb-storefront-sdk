import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  loadProvinces,
  loadWards,
  searchTextFor,
  __resetLocationCaches,
} from "./location-areas";
import type { LocationArea } from "@ecomweb/sdk";

const hcm: LocationArea = {
  level: 1,
  code: "12",
  parent_code: null,
  name: "Hồ Chí Minh",
  name_with_type: "Thành phố Hồ Chí Minh",
  type: "thanh-pho",
  slug: "ho-chi-minh",
  path: null,
  path_with_type: null,
};
const ward: LocationArea = {
  level: 2,
  code: "524",
  parent_code: "12",
  name: "Xóm Chiếu",
  name_with_type: "Phường Xóm Chiếu",
  type: "phuong",
  slug: "xom-chieu",
  path: "Xóm Chiếu, Hồ Chí Minh",
  path_with_type: "Phường Xóm Chiếu, Thành phố Hồ Chí Minh",
};

beforeEach(() => __resetLocationCaches());

describe("loadProvinces", () => {
  it("asks only for level 1, never the whole table", async () => {
    const fetcher = vi.fn().mockResolvedValue({ country_code: "VN", areas: [hcm] });
    await loadProvinces("s1", fetcher);
    expect(fetcher).toHaveBeenCalledWith("s1", { level: 1 });
  });

  it("shares one in-flight request between concurrent callers", async () => {
    const fetcher = vi.fn().mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(() => resolve({ country_code: "VN", areas: [hcm] }), 10)
        )
    );
    await Promise.all([
      loadProvinces("s1", fetcher),
      loadProvinces("s1", fetcher),
      loadProvinces("s1", fetcher),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failure", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ country_code: "VN", areas: [hcm] });
    await expect(loadProvinces("s1", fetcher)).rejects.toThrow("offline");
    expect(await loadProvinces("s1", fetcher)).toEqual([hcm]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps separate caches per store", async () => {
    const fetcher = vi.fn().mockResolvedValue({ country_code: "VN", areas: [hcm] });
    await loadProvinces("s1", fetcher);
    await loadProvinces("s2", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe("loadWards", () => {
  it("asks only for that province's children", async () => {
    const fetcher = vi.fn().mockResolvedValue({ country_code: "VN", areas: [ward] });
    expect(await loadWards("s1", "12", fetcher)).toEqual([ward]);
    expect(fetcher).toHaveBeenCalledWith("s1", { parent_code: "12" });
  });

  it("caches per province rather than globally", async () => {
    const fetcher = vi.fn().mockResolvedValue({ country_code: "VN", areas: [ward] });
    await loadWards("s1", "12", fetcher);
    await loadWards("s1", "12", fetcher);
    await loadWards("s1", "11", fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns nothing for a blank province without calling the API", async () => {
    const fetcher = vi.fn();
    expect(await loadWards("s1", "", fetcher)).toEqual([]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("does not cache a failure", async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ country_code: "VN", areas: [ward] });
    await expect(loadWards("s1", "12", fetcher)).rejects.toThrow("offline");
    expect(await loadWards("s1", "12", fetcher)).toEqual([ward]);
  });
});

describe("searchTextFor", () => {
  it("matches on the full name with type", () => {
    expect(searchTextFor(hcm)).toContain("Thành phố Hồ Chí Minh");
  });

  it("matches on the bare name", () => {
    expect(searchTextFor(hcm)).toContain("Hồ Chí Minh");
  });

  it("matches typing without accents, via the slug", () => {
    expect(searchTextFor(hcm)).toContain("ho chi minh");
  });

  it("keeps the code searchable for anyone who knows it", () => {
    expect(searchTextFor(hcm)).toContain("12");
  });

  it("handles an area whose slug is empty", () => {
    expect(() => searchTextFor({ ...hcm, slug: "" })).not.toThrow();
  });
});
