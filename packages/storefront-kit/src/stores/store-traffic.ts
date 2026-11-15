import { serverConfig } from "../config/server";

const WINDOW_MS = 60_000;

/**
 * Requests per store on this server, in fixed one-minute windows: the data
 * for sizing a per-store limit on the shared storefront. Log only; nothing
 * is refused.
 *
 * - A store reaching the threshold is logged at once ("over").
 * - When a window closes, every store that reached it is logged with its
 *   final count ("peak"). Windows close on the next request, so a server
 *   that goes quiet logs its last window late.
 *
 * Counts are this server's share only: multiply by the pod count for the
 * whole fleet.
 */
export class StoreTraffic {
  private windowStart: number | null = null;
  private counts = new Map<string, number>();

  constructor(
    private readonly threshold: number,
    private readonly log: (line: string) => void = console.warn
  ) {}

  hit(storeRef: string, now = Date.now()): void {
    if (this.threshold <= 0) return;
    if (this.windowStart === null) this.windowStart = now;
    if (now - this.windowStart >= WINDOW_MS) {
      this.flush();
      this.windowStart = now;
    }

    const count = (this.counts.get(storeRef) ?? 0) + 1;
    this.counts.set(storeRef, count);
    if (count === this.threshold) {
      this.log(
        `[store-traffic] over store=${storeRef} requests=${count} window=60s threshold=${this.threshold}`
      );
    }
  }

  private flush(): void {
    for (const [storeRef, count] of this.counts) {
      if (count >= this.threshold) {
        this.log(
          `[store-traffic] peak store=${storeRef} requests=${count} window=60s threshold=${this.threshold}`
        );
      }
    }
    this.counts.clear();
  }
}

let shared: StoreTraffic | undefined;

/**
 * Counts one request to `storeRef` (see StoreTraffic). Never throws: this is
 * measurement, and must not take a page down.
 */
export function recordStoreRequest(storeRef: string): void {
  try {
    shared ??= new StoreTraffic(serverConfig().storeTrafficLogPerMinute);
    shared.hit(storeRef);
  } catch {
    // Unreadable config: count nothing (the page reports it elsewhere).
  }
}
