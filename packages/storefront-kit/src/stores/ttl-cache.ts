/**
 * A small in-process cache with per-entry expiry and a size bound.
 *
 * The middleware resolves the store on every request; without this each one
 * is a round trip to the API (which caches in Redis, but the hop remains).
 * The bound matters because the key is the request's Host: random hosts
 * under the platform domain would otherwise grow the map without limit.
 *
 * Map keeps insertion order, so the first key is the oldest write; a hit
 * re-inserts its entry, which makes eviction least-recently-used.
 */
export class TtlCache<V> {
  private readonly entries = new Map<string, { value: V; expires: number }>();

  constructor(private readonly maxEntries: number) {}

  get(key: string, now = Date.now()): V | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    this.entries.delete(key);
    if (entry.expires <= now) return undefined;
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number, now = Date.now()): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: now + ttlMs });
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }

  clear(): void {
    this.entries.clear();
  }

  get size(): number {
    return this.entries.size;
  }
}
