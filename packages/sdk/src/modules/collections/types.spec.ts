import { describe, expect, expectTypeOf, it } from "vitest";
import type { Collection } from "./types";

describe("collection", () => {
  it("uses the API's type names: manual or smart", () => {
    expectTypeOf<Collection["type"]>().toEqualTypeOf<"manual" | "smart">();
  });

  it("a manual collection carries its product ids", () => {
    const collection: Collection = {
      id: 7,
      store_id: 1,
      name: "TVs",
      description: null,
      slug: "tvs",
      type: "manual",
      status: "active",
      image_url: null,
      search_criteria: null,
      collection_sort: null,
      created_at: "2026-10-18T00:00:00Z",
      updated_at: "2026-10-18T00:00:00Z",
      product_ids: [3, 1, 2],
    };
    expect(collection.product_ids).toEqual([3, 1, 2]);
    expectTypeOf<Collection["product_ids"]>().toEqualTypeOf<
      number[] | undefined
    >();
  });
});
