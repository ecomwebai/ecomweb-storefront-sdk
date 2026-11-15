import { describe, it, expect, vi } from "vitest";
import type { IHttpClient } from "../../core/types";
import { ShippingApi } from "./api";

function fakeHttp() {
  const post = vi.fn().mockResolvedValue({ success: true, data: [] });
  return { http: { post } as unknown as IHttpClient, post };
}

describe("ShippingApi.calculate", () => {
  it("calculate posts the request as given, flag included", async () => {
    const { http, post } = fakeHttp();
    await new ShippingApi(http).calculate("s1", {
      ward_id: "26734",
      subtotal: 1,
      currency: "VND",
      weight_gr: 500,
      include_carrier_options: true,
    });
    expect(post).toHaveBeenCalledWith(
      "/public/stores/s1/shipping/calculate",
      expect.objectContaining({ include_carrier_options: true })
    );
  });

  it("calculate adds no default flag", async () => {
    const { http, post } = fakeHttp();
    await new ShippingApi(http).calculate("s1", {
      ward_id: "26734",
      subtotal: 1,
      currency: "VND",
      weight_gr: 500,
    });
    expect(post.mock.calls[0][1]).not.toHaveProperty("include_carrier_options");
  });
});
