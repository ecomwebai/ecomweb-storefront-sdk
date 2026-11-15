import { describe, it, expect } from "vitest";
import type { ShippingOption } from "@ecomweb/sdk";
import { optionIdOf } from "./option-id";

describe("optionIdOf", () => {
  it("uses option_id when the API sends one", () => {
    expect(
      optionIdOf({ option_id: "41:svc", rate_id: 41 } as ShippingOption)
    ).toBe("41:svc");
  });

  it("falls back to rate_id for older APIs", () => {
    expect(optionIdOf({ rate_id: 41 } as ShippingOption)).toBe("41");
  });
});
