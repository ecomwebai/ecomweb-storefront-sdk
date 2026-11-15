import { describe, expect, it } from "vitest";
import { storeSchema } from "./store";

describe("storeSchema", () => {
  it("accepts a public store without user_id", () => {
    const parsed = storeSchema.safeParse({
      id: 1,
      name: "Acme",
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
      deleted_at: null,
    });
    expect(parsed.success).toBe(true);
  });
});
