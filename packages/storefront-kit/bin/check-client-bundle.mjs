#!/usr/bin/env node
// ecomweb-check-client-bundle [nextDir=.next]
// Unguarded entry: invoking it always runs the check (no argv/realpath test
// that could turn the build gate into a silent no-op).
import { main } from "./check-client-bundle-lib.mjs";

export { findSecretsInClientBundle } from "./check-client-bundle-lib.mjs";
main();
