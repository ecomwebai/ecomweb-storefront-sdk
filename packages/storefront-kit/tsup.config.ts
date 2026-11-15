import { defineConfig } from "tsup";

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
});
