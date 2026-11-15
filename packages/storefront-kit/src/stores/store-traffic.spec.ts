import { describe, expect, it, vi } from "vitest";
import { StoreTraffic } from "./store-traffic";

vi.mock("server-only", () => ({}));

describe("StoreTraffic", () => {
  it("logs a store once, as it reaches the threshold", () => {
    const log = vi.fn();
    const traffic = new StoreTraffic(3, log);
    for (let i = 0; i < 5; i++) traffic.hit("abc", 1000 + i);
    traffic.hit("other", 1010);

    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]![0]).toBe(
      "[store-traffic] over store=abc requests=3 window=60s threshold=3"
    );
  });

  it("logs each busy store's final count when the minute closes", () => {
    const log = vi.fn();
    const traffic = new StoreTraffic(2, log);
    for (let i = 0; i < 4; i++) traffic.hit("abc", i);
    traffic.hit("quiet", 10);
    log.mockClear();

    traffic.hit("abc", 60_000);

    expect(log.mock.calls.map(c => c[0])).toEqual([
      "[store-traffic] peak store=abc requests=4 window=60s threshold=2",
    ]);
  });

  it("starts each minute from zero", () => {
    const log = vi.fn();
    const traffic = new StoreTraffic(2, log);
    traffic.hit("abc", 0);
    traffic.hit("abc", 60_000);
    expect(log).not.toHaveBeenCalled();
  });

  it("does nothing with a threshold of 0", () => {
    const log = vi.fn();
    const traffic = new StoreTraffic(0, log);
    for (let i = 0; i < 100; i++) traffic.hit("abc", i * 1000);
    expect(log).not.toHaveBeenCalled();
  });
});
