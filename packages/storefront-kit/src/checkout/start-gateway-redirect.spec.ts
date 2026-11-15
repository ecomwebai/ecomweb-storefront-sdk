import { describe, expect, it, vi } from "vitest";
import { startGatewayRedirect } from "./start-gateway-redirect";

function deps(overrides: Partial<Parameters<typeof startGatewayRedirect>[0]> = {}) {
  const calls: string[] = [];
  return {
    calls,
    deps: {
      initiate: vi.fn(async () => {
        calls.push("initiate");
        return { redirect_url: "https://pay.example/checkout/1" };
      }),
      clearCart: vi.fn(async () => {
        calls.push("clearCart");
      }),
      navigate: vi.fn((url: string) => {
        calls.push(`navigate:${url}`);
      }),
      ...overrides,
    },
  };
}

describe("startGatewayRedirect", () => {
  it("clears the cart once the gateway has handed back a redirect, then leaves", async () => {
    // The order already holds these items. A cart left full sends the shopper
    // back from the gateway to the same items, and the next checkout places
    // them again.
    const { calls, deps: d } = deps();

    await startGatewayRedirect(d);

    expect(calls).toEqual([
      "initiate",
      "clearCart",
      "navigate:https://pay.example/checkout/1",
    ]);
  });

  it("waits for the clear before navigating, so the page unload cannot cancel it", async () => {
    let releaseClear!: () => void;
    const { deps: d } = deps({
      clearCart: vi.fn(
        () => new Promise<void>(resolve => (releaseClear = resolve))
      ),
    });

    const pending = startGatewayRedirect(d);
    await Promise.resolve();
    await Promise.resolve();
    expect(d.navigate).not.toHaveBeenCalled();

    releaseClear();
    await pending;
    expect(d.navigate).toHaveBeenCalledOnce();
  });

  it("keeps the cart when the redirect cannot be started", async () => {
    // The shopper stays on checkout with a retry button; their cart has to
    // still be there.
    const failure = new Error("gateway down");
    const { deps: d } = deps({
      initiate: vi.fn(async () => {
        throw failure;
      }),
    });

    await expect(startGatewayRedirect(d)).rejects.toBe(failure);
    expect(d.clearCart).not.toHaveBeenCalled();
    expect(d.navigate).not.toHaveBeenCalled();
  });

  it("still sends the shopper to pay when clearing the cart fails", async () => {
    // A stale cart is an annoyance; a shopper stranded before paying for an
    // order that already exists is a lost sale.
    const { deps: d } = deps({
      clearCart: vi.fn(async () => {
        throw new Error("cart api down");
      }),
    });

    await startGatewayRedirect(d);

    expect(d.navigate).toHaveBeenCalledWith("https://pay.example/checkout/1");
  });
});
