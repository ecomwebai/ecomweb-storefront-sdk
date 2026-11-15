import { readFileSync } from "node:fs";
import { defineConfig } from "tsup";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8")
) as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "es2022",
  // Sent in the X-Ecomweb-Client header (src/core/client-info.ts).
  define: { __ECOMWEB_SDK_VERSION__: JSON.stringify(version) },
});
