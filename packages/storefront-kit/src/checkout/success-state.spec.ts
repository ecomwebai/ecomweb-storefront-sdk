import { describe, it, expect } from "vitest";
import {
  resolveInitialState,
  shouldPollForConfirmation,
} from "./success-state";
import { matchHandoff } from "./order-handoff";
import type { OrderHandoff } from "./order-handoff";

function handoff(over: Partial<OrderHandoff> = {}): OrderHandoff {
  return {
    order_code: "NH-1001",
    payment_method: "bank_transfer",
    provider_code: null,
    total: 116696,
    currency_code: "VND",
    written_at: Date.now(),
    ...over,
  };
}

describe("resolveInitialState", () => {
  it("treats a page with no order code as an immediate success screen", () => {
    expect(resolveInitialState(null, null)).toBe("paid");
  });

  it("sends a bank transfer order to the transfer instructions", () => {
    expect(resolveInitialState("NH-1001", handoff())).toBe("awaiting-transfer");
  });

  it("sends a COD order to a plain placed confirmation", () => {
    expect(
      resolveInitialState("NH-1001", handoff({ payment_method: "cod" }))
    ).toBe("placed");
  });

  it("polls for a gateway order, which arrives with a provider_code", () => {
    expect(
      resolveInitialState(
        "NH-1001",
        handoff({ payment_method: "onepay", provider_code: "onepay" })
      )
    ).toBe("confirming");
  });

  it("polls when there is no handoff at all", () => {
    // The gateway return path arrives from the provider, on a device that may
    // never have written one. The API is the authority there anyway.
    expect(resolveInitialState("NH-1001", null)).toBe("confirming");
  });
});

describe("shouldPollForConfirmation", () => {
  it("polls only while confirming", () => {
    expect(shouldPollForConfirmation("confirming")).toBe(true);
  });

  it("does not poll an offline order, which has no callback coming", () => {
    // Polling one would burn the backoff budget and then downgrade a correct
    // screen to "still-confirming".
    expect(shouldPollForConfirmation("awaiting-transfer")).toBe(false);
    expect(shouldPollForConfirmation("placed")).toBe(false);
  });
});

describe("matchHandoff", () => {
  const now = 1_000_000_000;

  it("accepts a fresh handoff for the order being shown", () => {
    const parsed = { ...handoff(), written_at: now - 1000 };
    expect(matchHandoff(parsed, "NH-1001", now)).toMatchObject({
      payment_method: "bank_transfer",
      total: 116696,
    });
  });

  it("keeps a well-formed order summary and drops a malformed one", () => {
    const summary = {
      customer_name: "Nguyễn Test",
      phone: "0900000000",
      email: null,
      address: "1 Đường Thử Nghiệm, Phường A, Thành phố B",
      shipping_method: "Giao hàng nhanh",
      shipping_fee: 50000,
      payment_label: "Chuyển khoản ngân hàng",
      items: [
        { name: "Áo", variant: null, quantity: 2, price: 100000, image: null },
      ],
      subtotal: 200000,
      discount: 0,
    };
    expect(
      matchHandoff({ ...handoff(), summary, written_at: now }, "NH-1001", now)
        ?.summary
    ).toEqual(summary);
    expect(
      matchHandoff(
        { ...handoff(), summary: { items: "nope" }, written_at: now },
        "NH-1001",
        now
      )?.summary
    ).toBeNull();
  });

  it("rejects a handoff written for a different order", () => {
    // Showing one order's amount on another order's screen is worse than
    // showing no amount at all.
    const parsed = { ...handoff(), written_at: now };
    expect(matchHandoff(parsed, "NH-9999", now)).toBeNull();
  });

  it("rejects a handoff older than a day", () => {
    const parsed = { ...handoff(), written_at: now - 25 * 60 * 60 * 1000 };
    expect(matchHandoff(parsed, "NH-1001", now)).toBeNull();
  });

  it("rejects junk rather than throwing", () => {
    expect(matchHandoff(null, "NH-1001", now)).toBeNull();
    expect(matchHandoff("nope", "NH-1001", now)).toBeNull();
    expect(matchHandoff({ order_code: "NH-1001" }, "NH-1001", now)).toBeNull();
    expect(
      matchHandoff(
        { ...handoff(), total: "116696", written_at: now },
        "NH-1001",
        now
      )
    ).toBeNull();
  });

  it("defaults a missing currency to VND and normalises an empty provider", () => {
    const parsed = {
      order_code: "NH-1001",
      payment_method: "cod",
      provider_code: "",
      total: 1000,
      written_at: now,
    };
    expect(matchHandoff(parsed, "NH-1001", now)).toMatchObject({
      provider_code: null,
      currency_code: "VND",
    });
  });
});
