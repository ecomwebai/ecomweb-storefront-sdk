import { describe, expect, it } from "vitest";
import { ApiClientError } from "@ecomweb/sdk";
import {
  STOCK_ISSUE_TOAST_DESCRIPTION,
  insufficientItemsFrom,
  stockIssueCopy,
  stockIssuesByLine,
} from "./stock-issues";
import { errorCopy } from "../auth/error-copy";

const items = [
  { variant_id: 9, requested: 2, available: 1 },
  { variant_id: 12, requested: 1, available: 0 },
];

describe("insufficientItemsFrom", () => {
  it("reads details.items off an INSUFFICIENT_INVENTORY ApiClientError", () => {
    const error = new ApiClientError("English prose", 409, "INSUFFICIENT_INVENTORY", { items });
    expect(insufficientItemsFrom(error)).toEqual(items);
  });

  it("ignores other codes, and the right code without usable details", () => {
    expect(insufficientItemsFrom(new ApiClientError("x", 409, "INVENTORY_STATE_NEGATIVE", { items }))).toBeNull();
    expect(insufficientItemsFrom(new ApiClientError("x", 409, "INSUFFICIENT_INVENTORY"))).toBeNull();
    expect(insufficientItemsFrom(new ApiClientError("x", 409, "INSUFFICIENT_INVENTORY", { items: "nope" }))).toBeNull();
    expect(insufficientItemsFrom(new Error("network"))).toBeNull();
    expect(insufficientItemsFrom(undefined)).toBeNull();
  });

  it("drops malformed entries", () => {
    const error = new ApiClientError("x", 409, "INSUFFICIENT_INVENTORY", {
      items: [items[0], { variant_id: "9" }, null],
    });
    expect(insufficientItemsFrom(error)).toEqual([items[0]]);
  });
});

describe("stockIssueCopy", () => {
  it("says sold out when nothing is left", () => {
    expect(stockIssueCopy(items[1])).toBe("Sản phẩm này đã hết hàng.");
  });

  it("says how many are left otherwise", () => {
    expect(stockIssueCopy(items[0])).toBe("Chỉ còn 1 sản phẩm, vui lòng giảm số lượng.");
  });

  it("never uses an em dash", () => {
    for (const text of [stockIssueCopy(items[0]), stockIssueCopy(items[1]), STOCK_ISSUE_TOAST_DESCRIPTION, errorCopy("INSUFFICIENT_INVENTORY")]) {
      expect(text).not.toContain("—");
    }
  });
});

describe("stockIssuesByLine", () => {
  it("keys copy by cart line id through the line's variant", () => {
    const lines = [
      { id: "5-9", variantId: 9 },
      { id: "5-10", variantId: 10 },
      { id: "7", variantId: undefined },
      { id: "6-12", variantId: 12 },
    ];
    expect(stockIssuesByLine(lines, items)).toEqual({
      "5-9": "Chỉ còn 1 sản phẩm, vui lòng giảm số lượng.",
      "6-12": "Sản phẩm này đã hết hàng.",
    });
  });
});

describe("error copy", () => {
  it("has a shopper sentence for the code", () => {
    expect(errorCopy("INSUFFICIENT_INVENTORY")).toBe("Một số sản phẩm không đủ hàng.");
  });
});
