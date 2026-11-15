import { describe, expect, it } from "vitest";
import { TtlCache } from "./ttl-cache";

describe("TtlCache", () => {
  it("returns a value until it expires", () => {
    const cache = new TtlCache<string>(10);
    cache.set("a", "1", 1000, 0);
    expect(cache.get("a", 999)).toBe("1");
    expect(cache.get("a", 1000)).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it("keeps a cached null apart from a miss", () => {
    const cache = new TtlCache<string | null>(10);
    cache.set("a", null, 1000, 0);
    expect(cache.get("a", 1)).toBeNull();
    expect(cache.get("b", 1)).toBeUndefined();
  });

  it("evicts the least recently used entry past its bound", () => {
    const cache = new TtlCache<number>(2);
    cache.set("a", 1, 1000, 0);
    cache.set("b", 2, 1000, 0);
    cache.get("a", 1); // a is now the most recent
    cache.set("c", 3, 1000, 1);
    expect(cache.get("b", 2)).toBeUndefined();
    expect(cache.get("a", 2)).toBe(1);
    expect(cache.get("c", 2)).toBe(3);
  });
});
