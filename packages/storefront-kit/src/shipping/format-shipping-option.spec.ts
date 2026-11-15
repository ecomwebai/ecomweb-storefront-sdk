import { describe, it, expect } from "vitest";
import type { ShippingOption } from "@ecomweb/sdk";
import {
  isFreeShippingRate,
  formatShippingAmount,
  describeShippingOption,
} from "./format-shipping-option";

describe("isFreeShippingRate", () => {
  it("treats amount 0 as free", () => {
    expect(isFreeShippingRate(0)).toBe(true);
  });

  it("treats any positive amount as not free", () => {
    expect(isFreeShippingRate(1)).toBe(false);
    expect(isFreeShippingRate(25000)).toBe(false);
  });
});

describe("formatShippingAmount", () => {
  it("renders the free label for a zero-amount rate, never '0đ'", () => {
    const result = formatShippingAmount(0, "Miễn phí", "vi-VN", "VND");
    expect(result).toBe("Miễn phí");
    expect(result).not.toBe("0đ");
  });

  it("renders the house money format for a priced rate", () => {
    expect(formatShippingAmount(25000, "Miễn phí", "vi-VN", "VND")).toBe(
      "25.000đ",
    );
  });

  it("renders the English free label when passed", () => {
    expect(formatShippingAmount(0, "Free", "en-US", "VND")).toBe("Free");
  });

  it("does not treat a small positive amount as free", () => {
    expect(formatShippingAmount(1000, "Miễn phí", "vi-VN", "VND")).toBe(
      "1.000đ",
    );
  });
});

describe("describeShippingOption", () => {
  const base: ShippingOption = {
    amount: 25000,
    currency: "VND",
    rate_id: 1,
    delivery_type: "STANDARD",
    display_name: "Giao tiêu chuẩn",
  };

  it("a carrier option shows its carrier and AllinGo's ETA", () => {
    const d = describeShippingOption({
      ...base,
      carrier_name: "AhaMove",
      carrier_logo_url: "https://cdn.example.com/aha.png",
      estimated_label: "~45 phút",
      estimated_days_min: 1,
      estimated_days_max: 2,
    });
    expect(d).toEqual({
      title: "Giao tiêu chuẩn",
      carrierName: "AhaMove",
      carrierLogoUrl: "https://cdn.example.com/aha.png",
      eta: "~45 phút",
    });
  });

  it("names the service, so two services of one carrier differ", () => {
    const names = ["Giao chuẩn", "Giao nhanh"].map(
      (service) =>
        describeShippingOption({
          ...base,
          carrier_name: "GHN",
          carrier_service_name: service,
        }).carrierName
    );
    expect(names).toEqual(["GHN · Giao chuẩn", "GHN · Giao nhanh"]);
  });

  it("a fixed option keeps the day-range estimate", () => {
    const d = describeShippingOption({
      ...base,
      estimated_days_min: 2,
      estimated_days_max: 3,
    });
    expect(d.eta).toBe("Dự kiến giao: 2 đến 3 ngày");
    expect(d.carrierName).toBeNull();
    expect(d.carrierLogoUrl).toBeNull();
  });

  it("uses min for both ends when max is missing", () => {
    expect(
      describeShippingOption({ ...base, estimated_days_min: 2 }).eta,
    ).toBe("Dự kiến giao: 2 đến 2 ngày");
  });

  it("no estimate at all is null, never an empty string", () => {
    expect(describeShippingOption(base).eta).toBeNull();
    expect(
      describeShippingOption({ ...base, estimated_label: "" }).eta,
    ).toBeNull();
  });

  it("drops a non-http(s) carrier logo url", () => {
    for (const url of ["javascript:alert(1)", "data:image/png;base64,AA", "//x.com/a.png", "not a url"]) {
      expect(
        describeShippingOption({ ...base, carrier_logo_url: url })
          .carrierLogoUrl,
      ).toBeNull();
    }
  });
});
