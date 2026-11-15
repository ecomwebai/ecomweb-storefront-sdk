import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version: string };

/**
 * Unbundled ESM: each source file becomes its own module so per-file
 * "use client" directives survive (a bundled entry would merge client hooks
 * and server-safe helpers into one module with one directive).
 */
export default defineConfig({
  entry: ["src/**/*.{ts,tsx}", "!src/**/*.spec.{ts,tsx}"],
  bundle: false,
  format: ["esm"],
  dts: {
    entry: {
      index: "src/index.ts",
      server: "src/server.ts",
      middleware: "src/middleware.ts",
      config: "src/config.ts",
      theme: "src/theme/index.ts",
    },
  },
  clean: true,
  sourcemap: true,
  target: "es2022",
  // Sent in the X-Ecomweb-Client header and checked at build time
  // (src/client-info.ts).
  define: { __ECOMWEB_KIT_VERSION__: JSON.stringify(version) },
});
