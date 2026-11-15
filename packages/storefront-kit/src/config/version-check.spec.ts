import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { KIT_CLIENT_TOKEN, KIT_VERSION } from "../client-info";
import { checkClientVersions } from "./version-check";

const BUILD = "phase-production-build";
const { version } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
) as { version: string };

const body = {
  packages: {
    "@ecomweb/storefront-kit": { latest: "0.14.0", minimum_supported: "0.13.1", security_minimum: "0.13.1" },
    "@ecomweb/sdk": { latest: "0.14.0", minimum_supported: "0.13.1", security_minimum: "0.13.1" },
  },
  advisories: [
    { id: "2026-11-a", package: "@ecomweb/storefront-kit", fixed_in: "0.13.1", severity: "high", summary: "Checkout promotion code" },
    { id: "2026-11-b", package: "@ecomweb/sdk", fixed_in: "0.13.1", severity: "high", summary: "SDK thing" },
  ],
  upgrade_guide_url: "https://help.ecomweb.app/guides/storefront/upgrade-kit",
};

function setup(response: () => Promise<Response> | Response = () => Response.json(body)) {
  const fetchMock = vi.fn(async (..._args: unknown[]) => response());
  const warn = vi.fn();
  return { fetchMock, warn, env: {} as Record<string, string | undefined> };
}

describe("kit version", () => {
  it("bakes in package.json's version", () => {
    expect(KIT_VERSION).toBe(version);
    expect(KIT_CLIENT_TOKEN).toBe(`@ecomweb/storefront-kit/${version}`);
  });
});

describe("checkClientVersions", () => {
  it("does nothing outside next build", async () => {
    const { fetchMock, warn, env } = setup();
    const r = await checkClientVersions({ phase: "phase-development-server", env, fetch: fetchMock as any, warn });
    expect(r).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is skipped with ECOMWEB_SKIP_VERSION_CHECK=1", async () => {
    const { fetchMock, warn } = setup();
    const r = await checkClientVersions({ phase: BUILD, env: { ECOMWEB_SKIP_VERSION_CHECK: "1" }, fetch: fetchMock as any, warn });
    expect(r).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches the public versions endpoint with a timeout, once per build", async () => {
    const { fetchMock, warn, env } = setup();
    await checkClientVersions({ phase: BUILD, apiUrl: "https://api.test/api/v1/", env, fetch: fetchMock as any, warn, installed: { kit: "0.14.0", sdk: "0.14.0" } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/api/v1/public/storefront-clients/versions");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    await checkClientVersions({ phase: BUILD, env, fetch: fetchMock as any, warn });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns of a security update, with the advisories that apply", async () => {
    const { fetchMock, warn, env } = setup();
    const r = await checkClientVersions({ phase: BUILD, env, fetch: fetchMock as any, warn, installed: { kit: "0.12.0", sdk: "0.14.0" } });
    expect(r?.status).toBe("security_update");
    expect(r?.package).toBe("@ecomweb/storefront-kit");
    const message = warn.mock.calls[0][0] as string;
    expect(message).toContain("security update");
    expect(message).toContain("@ecomweb/storefront-kit 0.12.0 has known security issues (latest 0.14.0)");
    expect(message).toContain("Checkout promotion code (fixed in 0.13.1)");
    expect(message).not.toContain("SDK thing");
    expect(message).toContain("ecomweb storefront upgrade");
    expect(message).toContain("https://help.ecomweb.app/guides/storefront/upgrade-kit");
  });

  it("warns of an update when only behind latest, judging the SDK too", async () => {
    const { fetchMock, warn, env } = setup();
    const r = await checkClientVersions({ phase: BUILD, env, fetch: fetchMock as any, warn, installed: { kit: "0.14.0", sdk: "0.13.5" } });
    expect(r?.status).toBe("update_available");
    expect(r?.package).toBe("@ecomweb/sdk");
    expect(warn.mock.calls[0][0]).toContain("update available: @ecomweb/sdk 0.13.5");
  });

  it("reports unsupported below minimum_supported", async () => {
    const { fetchMock, warn, env } = setup(() =>
      Response.json({ ...body, packages: { "@ecomweb/storefront-kit": { latest: "0.14.0", minimum_supported: "0.13.0", security_minimum: "0.1.0" } } })
    );
    const r = await checkClientVersions({ phase: BUILD, env, fetch: fetchMock as any, warn, installed: { kit: "0.12.9", sdk: "dev" } });
    expect(r?.status).toBe("unsupported");
    expect(warn.mock.calls[0][0]).toContain("no longer supported");
  });

  it("ignores errors, bad responses and non-semver versions", async () => {
    for (const response of [
      () => Promise.reject(new Error("offline")),
      () => new Response("nope", { status: 500 }),
      () => new Response("not json", { status: 200 }),
    ]) {
      const { fetchMock, warn, env } = setup(response);
      await expect(checkClientVersions({ phase: BUILD, env, fetch: fetchMock as any, warn, installed: { kit: "0.1.0", sdk: "0.1.0" } })).resolves.toBeNull();
      expect(warn).not.toHaveBeenCalled();
    }
    const { fetchMock, warn, env } = setup();
    await expect(checkClientVersions({ phase: BUILD, env, fetch: fetchMock as any, warn, installed: { kit: "dev", sdk: "dev" } })).resolves.toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });

  it("gives up after the timeout", async () => {
    const { warn, env } = setup();
    const hanging = vi.fn((_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => init.signal?.addEventListener("abort", () => reject(init.signal?.reason)))
    );
    const started = Date.now();
    const r = await checkClientVersions({ phase: BUILD, env, fetch: hanging as any, warn, timeoutMs: 50, installed: { kit: "0.1.0", sdk: "0.1.0" } });
    expect(r).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  });
});
