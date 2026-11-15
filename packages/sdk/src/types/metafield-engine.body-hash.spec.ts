import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * SHA-256 of the engine body: everything after the "// @engine-body" line of
 * metafield-engine.ts. The ecomweb-api and ecomweb-dashboard copies record this
 * hash in their headers (spec §5.4). When this test fails you changed the
 * engine: paste the received hash here, then re-copy the body into both repos.
 */
const ENGINE_BODY_SHA256 =
  "a53835b97293e25e3d636780eaee77e4efe90e14ae9cd1e87677ed8a306d0953";

const MARKER = "// @engine-body\n";

function engineBodyHash(): string {
  const source = readFileSync(
    new URL("./metafield-engine.ts", import.meta.url),
    "utf8"
  );
  const at = source.indexOf(MARKER);
  if (at === -1) throw new Error("metafield-engine.ts has no @engine-body marker");
  return createHash("sha256")
    .update(source.slice(at + MARKER.length))
    .digest("hex");
}

describe("metafield engine body", () => {
  it("matches the hash the API and dashboard copies record", () => {
    expect(engineBodyHash()).toBe(ENGINE_BODY_SHA256);
  });
});
