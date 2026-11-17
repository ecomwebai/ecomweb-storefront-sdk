// Logic of ecomweb-check-client-bundle (the bin is a thin entry).
// Fails a build when a secret key reached client code: scans
// <nextDir>/static/**/*.js and <nextDir>/server/app/**/*.{html,rsc,body}.
// Reports file paths and which pattern/env var matched, never the value.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const KEY_SHAPE = /sk_(storefront|platform|live)_[A-Za-z0-9]{16,}/;
// Shorter values would match unrelated text; real secrets are far longer.
const MIN_VALUE_LENGTH = 8;
const SECRET_ENV_NAMES = ["ECOMWEB_SECRET_KEY", "PLATFORM_SECRET_KEY", "CLIENT_IP_FORWARDER_SECRET"];

function walk(dir, accept, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, accept, out);
    else if (accept(name)) out.push(full);
  }
  return out;
}

/** @returns {string[]} "<relative file>: <what>" per hit, never the secret itself. */
export function findSecretsInClientBundle(nextDir, env) {
  const files = [
    ...walk(join(nextDir, "static"), (n) => /\.(js|map|json)$/.test(n)),
    ...walk(join(nextDir, "server", "app"), (n) => /\.(html|rsc|body|meta)$/.test(n)),
  ];
  const hits = [];
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    const rel = relative(nextDir, file).split("\\").join("/");
    if (KEY_SHAPE.test(text)) hits.push(`${rel}: an sk_storefront_/sk_live_/sk_platform_ key`);
    for (const name of SECRET_ENV_NAMES) {
      const value = env[name];
      if (value && value.length >= MIN_VALUE_LENGTH && text.includes(value)) hits.push(`${rel}: the value of ${name}`);
    }
  }
  return hits;
}


/** Runs the check; exits 1 on a hit or a missing nextDir. */
export function main(argv = process.argv.slice(2), env = process.env) {
  const nextDir = resolve(argv[0] ?? ".next");
  if (!existsSync(nextDir)) {
    console.error(`ecomweb-check-client-bundle: ${nextDir} not found; run next build first`);
    process.exit(1);
  }
  const hits = findSecretsInClientBundle(nextDir, env);
  if (hits.length > 0) {
    console.error("ecomweb-check-client-bundle: a secret reached client code:");
    for (const hit of hits) console.error(`  ${hit}`);
    process.exit(1);
  }
  console.log("ecomweb-check-client-bundle: no secret found in the client bundle");
}
