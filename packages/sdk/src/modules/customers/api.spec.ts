import { describe, expect, it, vi } from "vitest";
import { CustomersApi } from "./api";

const metafields = { "custom.birthday": { type: "date", value: "1990-05-01" } };

describe("CustomersApi metafields", () => {
  it("reads the signed-in customer's metafields", async () => {
    const get = vi.fn(async () => ({ success: true, data: metafields }));
    const api = new CustomersApi({ get } as any);
    expect(await api.getMetafields("abc")).toEqual(metafields);
    expect(get).toHaveBeenCalledWith("/storefront/stores/abc/customers/metafields");
  });

  it("writes values and returns the updated set", async () => {
    const put = vi.fn(async () => ({ success: true, data: metafields }));
    const api = new CustomersApi({ put } as any);
    const values = [{ namespace: "custom", key: "birthday", value: "1990-05-01" }];
    expect(await api.updateMetafields("abc", values)).toEqual(metafields);
    expect(put).toHaveBeenCalledWith("/storefront/stores/abc/customers/metafields", { values });
  });

  it("throws the API's validation error with its details", async () => {
    const put = vi.fn(async () => ({
      success: false,
      error: {
        statusCode: 400,
        message: "Invalid metafield value",
        error: "METAFIELD_VALUE_INVALID",
        details: { errors: [{ path: "values[0].value", code: "invalid_format" }] },
      },
    }));
    const api = new CustomersApi({ put } as any);
    await expect(api.updateMetafields("abc", [])).rejects.toMatchObject({
      code: "METAFIELD_VALUE_INVALID",
      details: { errors: [{ path: "values[0].value", code: "invalid_format" }] },
    });
  });
});
