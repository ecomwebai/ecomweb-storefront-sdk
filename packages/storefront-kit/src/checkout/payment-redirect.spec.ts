import { describe, expect, it } from "vitest";
import { getPaymentRedirectIntent } from "./payment-redirect";

describe("getPaymentRedirectIntent", () => {
  it("returns a redirect intent carrying the provider code for a gateway-backed method", () => {
    const intent = getPaymentRedirectIntent(
      { provider_code: "onepay" },
      "DH-1042-26"
    );

    expect(intent).toEqual({
      provider_code: "onepay",
      order_code: "DH-1042-26",
    });
  });

  it("returns none when provider_code is explicitly null", () => {
    expect(
      getPaymentRedirectIntent({ provider_code: null }, "DH-1042-26")
    ).toBeNull();
  });

  it("returns none when provider_code is absent/undefined", () => {
    expect(getPaymentRedirectIntent({}, "DH-1042-26")).toBeNull();
    expect(getPaymentRedirectIntent(undefined, "DH-1042-26")).toBeNull();
  });

  it("returns none for cod, a full StorePaymentMethod-shaped fixture with no provider_code", () => {
    // Full shape (not just { provider_code }) so this genuinely exercises a
    // cod method rather than re-running the null-provider_code case under a
    // different name: the function must ignore payment_method entirely and
    // decide on provider_code alone.
    const codMethod = {
      id: 1,
      store_id: 1,
      payment_method: "cod",
      display_name: "Thanh toán khi nhận hàng",
      is_enabled: true,
      sort_order: 0,
      provider_code: null,
    };

    expect(getPaymentRedirectIntent(codMethod, "DH-1042-26")).toBeNull();
  });

  it("returns none for bank_transfer, a full StorePaymentMethod-shaped fixture with no provider_code", () => {
    const bankTransferMethod = {
      id: 2,
      store_id: 1,
      payment_method: "bank_transfer",
      display_name: "Chuyển khoản ngân hàng",
      is_enabled: true,
      sort_order: 1,
      provider_code: null,
    };

    expect(
      getPaymentRedirectIntent(bankTransferMethod, "DH-1042-26")
    ).toBeNull();
  });

  it("carries order_code, not an order id — the initiate endpoint is keyed on order_code deliberately", () => {
    const intent = getPaymentRedirectIntent(
      { provider_code: "momo" },
      "#1001"
    );

    expect(intent).not.toBeNull();
    expect(intent?.order_code).toBe("#1001");
    // No id-shaped field should ever appear on the intent.
    expect(intent).not.toHaveProperty("order_id");
    expect(intent).not.toHaveProperty("id");
  });
});
