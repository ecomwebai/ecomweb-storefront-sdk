import { describe, it, expect } from "vitest";
import { findProvinceByCodeOrName, findWardByCodeOrName } from "./utils";
import type { LocationArea } from "@ecomweb/sdk";

const hanoi: LocationArea = {
  level: 1,
  code: "11",
  parent_code: null,
  name: "Hà Nội",
  name_with_type: "Thành phố Hà Nội",
  type: "thanh-pho",
  slug: "ha-noi",
  path: null,
  path_with_type: null,
};
const minhChau: LocationArea = {
  level: 2,
  code: "267",
  parent_code: "11",
  name: "Minh Châu",
  name_with_type: "Xã Minh Châu",
  type: "xa",
  slug: "minh-chau",
  path: "Minh Châu, Hà Nội",
  path_with_type: "Xã Minh Châu, Thành phố Hà Nội",
};
const otherProvinceWard: LocationArea = {
  ...minhChau,
  code: "999",
  parent_code: "12",
};

describe("findProvinceByCodeOrName", () => {
  it("matches on code, name and name_with_type", () => {
    for (const id of ["11", "Hà Nội", "Thành phố Hà Nội"]) {
      expect(findProvinceByCodeOrName(id, [hanoi])?.code).toBe("11");
    }
  });

  it("returns undefined for a blank identifier", () => {
    expect(findProvinceByCodeOrName(undefined, [hanoi])).toBeUndefined();
  });

  it("returns undefined when nothing matches", () => {
    expect(findProvinceByCodeOrName("99", [hanoi])).toBeUndefined();
  });
});

describe("findWardByCodeOrName", () => {
  it("restricts the search to one province when given its code", () => {
    expect(
      findWardByCodeOrName("267", [minhChau, otherProvinceWard], "12")
    ).toBeUndefined();
    expect(
      findWardByCodeOrName("267", [minhChau, otherProvinceWard], "11")?.code
    ).toBe("267");
  });

  it("matches on a path fragment", () => {
    expect(findWardByCodeOrName("Minh Châu, Hà Nội", [minhChau])?.code).toBe(
      "267"
    );
  });

  it("tolerates an area whose path fields are null", () => {
    expect(() => findWardByCodeOrName("x", [hanoi])).not.toThrow();
  });
});
