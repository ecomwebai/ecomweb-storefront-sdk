import { describe, expect, it } from "vitest";
import type { IHttpClient } from "./core/types";
import { createEcomwebServerSdk } from "./factory";

// The storefront kit's server client (`authHttpClient`) joins the API base and
// the path as plain strings, unlike axios. A path without a leading "/" turns
// into ".../api/v1public/...". Call every method of every module and check the
// path each one sends.
function recorder(urls: string[]): IHttpClient {
  const record = async (url: string) => {
    urls.push(url);
    return { success: true, data: {} };
  };
  return {
    get: record,
    post: record,
    put: record,
    patch: record,
    delete: record,
  } as unknown as IHttpClient;
}

function methodsOf(obj: object): string[] {
  const names = new Set<string>();
  for (
    let proto = Object.getPrototypeOf(obj);
    proto && proto !== Object.prototype;
    proto = Object.getPrototypeOf(proto)
  ) {
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === "constructor") continue;
      const desc = Object.getOwnPropertyDescriptor(proto, name);
      if (typeof desc?.value === "function") names.add(name);
    }
  }
  return [...names];
}

describe("SDK paths", () => {
  it("every module method sends a path that starts with /", async () => {
    const urls: string[] = [];
    const sdk = createEcomwebServerSdk({
      publicHttp: recorder(urls),
      authHttp: recorder(urls),
      secretKey: "sk_storefront_test",
    });
    const args = ["s", "x", { a: 1 }, true, "y"];
    let called = 0;
    for (const [moduleName, mod] of Object.entries(sdk)) {
      for (const name of methodsOf(mod)) {
        // Private helpers (no API call) may run too; only recorded calls count.
        try {
          await (mod as Record<string, (...a: unknown[]) => unknown>)[name](
            ...args
          );
        } catch {
          // Methods that reject the dummy args are fine; they made no call.
        }
        called++;
        for (const url of urls.splice(0)) {
          expect(url, `${moduleName}.${name}`).toMatch(/^\//);
          // Every storefront call is on /storefront/; the build-time version
          // check is the one /public/ route (and is not an SDK call).
          expect(url, `${moduleName}.${name}`).toMatch(
            /^\/(storefront\/|public\/storefront-clients\/versions)/
          );
        }
      }
    }
    // Guard against the sweep silently covering nothing.
    expect(called).toBeGreaterThan(50);
  });
});
