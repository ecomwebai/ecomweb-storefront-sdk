import { beforeEach, describe, expect, it, vi } from "vitest";

const { direct, proxy, mkClient } = vi.hoisted(() => {
  const recorder = () => ({
    get: vi.fn(async (..._args: unknown[]) => ({ success: true, data: null })),
  });
  const mkClient = (r: { get: unknown }) => ({
    get: r.get,
    post: r.get,
    put: r.get,
    patch: r.get,
    delete: r.get,
  });
  return { direct: recorder(), proxy: recorder(), mkClient };
});
vi.mock("./api/client", () => ({
  publicApiClient: mkClient(direct),
  createStoreApiClient: () => mkClient(proxy),
}));

import { createStoreSdk, sdk } from "./sdk";
import { KIT_CLIENT_TOKEN } from "./client-info";
import { SDK_CLIENT_TOKEN } from "@ecomweb/sdk";

describe("kit sdk", () => {
  beforeEach(() => {
    direct.get.mockClear();
    proxy.get.mockClear();
  });

  it("sends X-Ecomweb-Client as `<kit token> <sdk token>`", async () => {
    await createStoreSdk("s").stores.getById("s");
    await createStoreSdk("s").addresses.list("s");
    const calls = [...direct.get.mock.calls, ...proxy.get.mock.calls];
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect((call[1] as any).headers["X-Ecomweb-Client"]).toBe(
        `${KIT_CLIENT_TOKEN} ${SDK_CLIENT_TOKEN}`
      );
    }
    expect(KIT_CLIENT_TOKEN).not.toContain("/dev");
  });

  it("sends guest cart, guest order lookup and payment calls to the proxy", async () => {
    const s = createStoreSdk("s");
    await s.cart.getCart("s", "sess", false);
    await s.orders.lookupGuest("s", {
      order_number: 1,
      customer_email: "a@b.c",
    });
    await s.payments.getPaymentState("s", "ORD1");
    expect(direct.get).not.toHaveBeenCalled();
    expect(proxy.get).toHaveBeenCalledTimes(3);
  });

  it("module-level sdk exposes no private module", () => {
    expect("cart" in sdk).toBe(false);
  });
});
