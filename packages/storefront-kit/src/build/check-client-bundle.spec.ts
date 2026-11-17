import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { findSecretsInClientBundle } from "../../bin/check-client-bundle-lib.mjs";

function fixture(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "client-bundle-"));
  for (const [rel, body] of Object.entries(files)) {
    const file = join(dir, rel);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  return dir;
}

describe("findSecretsInClientBundle", () => {
  it("finds a secret's exact value in a client chunk without printing it", () => {
    const dir = fixture({ "static/chunks/a.js": 'x="sk_storefront_SENTINELabcdefghijklmnop"' });
    const hits = findSecretsInClientBundle(dir, {
      ECOMWEB_SECRET_KEY: "sk_storefront_SENTINELabcdefghijklmnop",
    });
    expect(hits).toEqual(expect.arrayContaining([expect.stringContaining("static/chunks/a.js")]));
    expect(hits.join("\n")).toContain("ECOMWEB_SECRET_KEY");
    expect(hits.join("\n")).not.toContain("SENTINEL");
  });

  it("finds an exact env value that does not look like a key", () => {
    const dir = fixture({ "static/chunks/c.js": 'y="plain-forwarder-value-123"' });
    const hits = findSecretsInClientBundle(dir, { CLIENT_IP_FORWARDER_SECRET: "plain-forwarder-value-123" });
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("CLIENT_IP_FORWARDER_SECRET");
    expect(hits[0]).not.toContain("plain-forwarder");
  });

  it("finds key-shaped strings in prerendered pages", () => {
    const dir = fixture({
      "server/app/index.html": "<p>sk_live_" + "a1B2c3D4e5F6g7H8i9J0" + "</p>",
    });
    const hits = findSecretsInClientBundle(dir, {});
    expect(hits).toHaveLength(1);
    expect(hits[0]).toContain("server/app/index.html");
    expect(hits[0]).not.toContain("a1B2c3D4");
  });

  it("scans .rsc and .body files too", () => {
    const dir = fixture({
      "server/app/p.rsc": "sk_platform_" + "x".repeat(20),
      "server/app/q.body": "sk_storefront_" + "y".repeat(20),
    });
    expect(findSecretsInClientBundle(dir, {})).toHaveLength(2);
  });

  it("ignores server chunks and short look-alikes", () => {
    const dir = fixture({
      "server/chunks/s.js": "sk_storefront_abcdefghijklmnopqrstu",
      "static/chunks/b.js": '"sk_live_"',
    });
    expect(findSecretsInClientBundle(dir, {})).toEqual([]);
  });

  it("ignores unset or empty env values", () => {
    const dir = fixture({ "static/chunks/d.js": "anything" });
    expect(findSecretsInClientBundle(dir, { ECOMWEB_SECRET_KEY: "", PLATFORM_SECRET_KEY: undefined })).toEqual([]);
  });
});

describe("ecomweb-check-client-bundle CLI", () => {
  const bin = fileURLToPath(new URL("../../bin/check-client-bundle.mjs", import.meta.url));
  const link = join(mkdtempSync(join(tmpdir(), "client-bundle-bin-")), "ecomweb-check-client-bundle");
  symlinkSync(bin, link);
  const run = (entry: string, args: string[], env: Record<string, string> = {}) =>
    spawnSync(process.execPath, [entry, ...args], { encoding: "utf8", env: { PATH: process.env.PATH ?? "", ...env } as unknown as NodeJS.ProcessEnv });

  for (const [label, entry] of [["directly", bin], ["through a symlink (like .bin)", link]] as const) {
    it(`exits 1 on a hit and prints no value, ${label}`, () => {
      const dir = fixture({ "static/chunks/a.js": 'x="sk_storefront_SENTINELabcdefghijklmnop"' });
      const r = run(entry, [dir], { ECOMWEB_SECRET_KEY: "sk_storefront_SENTINELabcdefghijklmnop" });
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("static/chunks/a.js");
      expect(r.stderr).toContain("ECOMWEB_SECRET_KEY");
      expect(r.stdout + r.stderr).not.toContain("SENTINEL");
    });
    it(`exits 1 when nextDir is missing, ${label}`, () => {
      const r = run(entry, [join(tmpdir(), "no-such-next-dir-xyz")]);
      expect(r.status).toBe(1);
      expect(r.stderr).toContain("run next build first");
    });
    it(`exits 0 with the pass line on a clean dir, ${label}`, () => {
      const r = run(entry, [fixture({ "static/chunks/ok.js": "console.log(1)" })]);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("no secret found in the client bundle");
    });
  }
});
