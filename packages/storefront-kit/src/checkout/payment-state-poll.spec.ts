import { describe, expect, it, vi } from "vitest";
import {
  computeBackoffDelay,
  pollPaymentState,
  type PaymentStateResult,
} from "./payment-state-poll";

/** A `wait` stand-in that never actually waits — records the delays it was
 * asked for so tests can assert on the schedule without real or fake
 * timers. */
function recordingWait() {
  const delays: number[] = [];
  const wait = async (ms: number) => {
    delays.push(ms);
  };
  return { wait, delays };
}

const paid: PaymentStateResult = {
  payment_status: "paid",
  order_status: "processing",
};
const failed: PaymentStateResult = {
  payment_status: "failed",
  order_status: "on_hold",
};
const pending: PaymentStateResult = {
  payment_status: "pending",
  order_status: "pending",
};

describe("pollPaymentState", () => {
  it("stops immediately when the first poll returns paid", async () => {
    const { wait } = recordingWait();
    const poll = vi.fn().mockResolvedValue(paid);

    const outcome = await pollPaymentState({ poll, wait, maxAttempts: 5 });

    expect(outcome).toEqual({ status: "paid", result: paid });
    expect(poll).toHaveBeenCalledTimes(1);
  });

  it("stops when a poll returns failed", async () => {
    const { wait } = recordingWait();
    const poll = vi
      .fn()
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(failed);

    const outcome = await pollPaymentState({ poll, wait, maxAttempts: 5 });

    expect(outcome).toEqual({ status: "failed", result: failed });
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured maximum attempts and returns a pending outcome, never failed", async () => {
    const { wait } = recordingWait();
    const poll = vi.fn().mockResolvedValue(pending);

    const outcome = await pollPaymentState({ poll, wait, maxAttempts: 4 });

    expect(poll).toHaveBeenCalledTimes(4);
    // The critical assertion: exhausting attempts must land on "pending",
    // never "failed" — a late callback is normal, not a payment failure.
    expect(outcome.status).toBe("pending");
    expect(outcome.status).not.toBe("failed");
    expect(outcome).toEqual({ status: "pending", result: pending });
  });

  it("does not abort the sequence on a single poll error, and can still resolve", async () => {
    const { wait } = recordingWait();
    const poll = vi
      .fn()
      .mockRejectedValueOnce(new Error("network blip"))
      .mockResolvedValueOnce(paid);

    const outcome = await pollPaymentState({ poll, wait, maxAttempts: 5 });

    expect(outcome).toEqual({ status: "paid", result: paid });
    expect(poll).toHaveBeenCalledTimes(2);
  });

  it("survives consecutive errors up to the cap and still ends in pending, not failed", async () => {
    const { wait } = recordingWait();
    const poll = vi.fn().mockRejectedValue(new Error("gateway down"));

    const outcome = await pollPaymentState({ poll, wait, maxAttempts: 3 });

    expect(poll).toHaveBeenCalledTimes(3);
    expect(outcome).toEqual({ status: "pending", result: null });
  });

  it("applies a delay between attempts rather than firing back-to-back", async () => {
    const { wait, delays } = recordingWait();
    const poll = vi.fn().mockResolvedValue(pending);

    await pollPaymentState({
      poll,
      wait,
      maxAttempts: 4,
      baseDelayMs: 1000,
      backoffFactor: 2,
    });

    // 4 attempts -> only 3 gaps between them; no trailing wait after the
    // final (give-up) attempt.
    expect(delays).toHaveLength(3);
    delays.forEach(ms => expect(ms).toBeGreaterThan(0));
  });

  it("increases the delay between successive attempts (backoff, not a fixed interval)", async () => {
    const { wait, delays } = recordingWait();
    const poll = vi.fn().mockResolvedValue(pending);

    await pollPaymentState({
      poll,
      wait,
      maxAttempts: 4,
      baseDelayMs: 1000,
      backoffFactor: 2,
      maxDelayMs: 60000,
    });

    expect(delays).toEqual([1000, 2000, 4000]);
  });

  it("caps the delay at maxDelayMs instead of growing without bound", () => {
    const delay = computeBackoffDelay(10, 1000, 2, 15000);
    expect(delay).toBe(15000);
  });

  it("computeBackoffDelay grows with the attempt index", () => {
    expect(computeBackoffDelay(0, 1000, 2, 60000)).toBe(1000);
    expect(computeBackoffDelay(1, 1000, 2, 60000)).toBe(2000);
    expect(computeBackoffDelay(2, 1000, 2, 60000)).toBe(4000);
  });
});
