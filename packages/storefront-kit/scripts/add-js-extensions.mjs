/**
 * tsup's unbundled output keeps extensionless relative imports ("./auth/context"),
 * which bundlers resolve but Node's ESM loader (vitest, scripts) does not.
 * Rewrites them to the emitted file: "./x.js" or "./x/index.js".
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const DIST = path.resolve(import.meta.dirname, "../dist");
const SPECIFIER = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(["'])(\.{1,2}\/[^"']*)\2/g;

function walk(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = path.join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
}

let missing = 0;
for (const file of walk(DIST)) {
  const text = readFileSync(file, "utf8");
  const next = text.replace(SPECIFIER, (all, lead, quote, spec) => {
    if (/\.(m?js|json)$/.test(spec)) return all;
    const base = path.resolve(path.dirname(file), spec);
    const target = existsSync(`${base}.js`)
      ? `${spec}.js`
      : existsSync(path.join(base, "index.js"))
        ? `${spec}/index.js`
        : null;
    if (!target) {
      console.error(`${path.relative(DIST, file)}: cannot resolve ${spec}`);
      missing++;
      return all;
    }
    return `${lead}${quote}${target}${quote}`;
  });
  if (next !== text) writeFileSync(file, next);
}
if (missing) process.exit(1);
