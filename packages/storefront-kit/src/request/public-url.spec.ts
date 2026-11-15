import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { publicNextUrl } from "./public-url";

// What a standalone Next server behind a proxy sees: request.url carries its
// own bind address, the proxy's headers carry the shopper's.
const behindProxy = (headers: Record<string, string>) =>
  new NextRequest("http://0.0.0.0:3000/api/auth/google/complete?code=x", { headers });

describe("publicNextUrl", () => {
  it("uses the host and scheme the shopper used, not the server's bind address", () => {
    const url = publicNextUrl(behindProxy({ host: "labshop.example.com", "x-forwarded-proto": "https" }));
    expect(url.toString()).toBe("https://labshop.example.com/api/auth/google/complete?code=x");
    expect(new URL("/auth/error", url).toString()).toBe("https://labshop.example.com/auth/error");
  });

  it("prefers X-Forwarded-Host, taking the first of a list", () => {
    const url = publicNextUrl(
      behindProxy({ host: "10.0.0.5:3000", "x-forwarded-host": "shop.example.com, inner.local", "x-forwarded-proto": "https, http" }),
    );
    expect(url.origin).toBe("https://shop.example.com");
  });

  it("keeps the request's own URL in local development (no proxy headers)", () => {
    const url = publicNextUrl(new NextRequest("http://localhost:3002/account", { headers: { host: "localhost:3002" } }));
    expect(url.origin).toBe("http://localhost:3002");
  });

  it("ignores malformed forwarded values", () => {
    const url = publicNextUrl(
      behindProxy({ host: "shop.example.com", "x-forwarded-host": "evil.com/path?x", "x-forwarded-proto": "javascript" }),
    );
    expect(url.origin).toBe("http://shop.example.com");
  });
});
