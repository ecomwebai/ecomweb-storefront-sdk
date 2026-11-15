import { readFileSync } from "node:fs";
import { defineConfig } from "vitest/config";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version: string };

export default defineConfig({
  // What tsup bakes in (src/core/client-info.ts).
  define: { __ECOMWEB_SDK_VERSION__: JSON.stringify(version) },
  test: {
    include: ["src/**/*.spec.ts", "src/**/*.test.ts"],
    environment: "node",
  },
});
