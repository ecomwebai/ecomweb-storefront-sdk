import { SDK_VERSION } from "@ecomweb/sdk";
import { KIT_VERSION } from "../client-info";
import type { EnvSource } from "./schema";

/** Next's `phase` for `next build` (next/constants PHASE_PRODUCTION_BUILD). */
const PRODUCTION_BUILD_PHASE = "phase-production-build";
const DEFAULT_API_URL = "https://apibase.ecomweb.app/api/v1";
const DEFAULT_TIMEOUT_MS = 2000;
// Set once a build has checked, so Next's build workers (which load the
// config again and inherit the env) stay quiet.
const CHECKED_FLAG = "__ECOMWEB_VERSION_CHECKED";

const KIT_PACKAGE = "@ecomweb/storefront-kit";
const SDK_PACKAGE = "@ecomweb/sdk";

interface PackagePolicy {
  latest?: string;
  minimum_supported?: string;
  security_minimum?: string;
}

interface Advisory {
  id?: string;
  package?: string;
  fixed_in?: string;
  severity?: string;
  summary?: string;
  url?: string;
}

interface VersionsResponse {
  packages?: Record<string, PackagePolicy | undefined>;
  advisories?: Advisory[];
  upgrade_guide_url?: string;
}

export type ClientVersionStatus =
  | "up_to_date"
  | "update_available"
  | "unsupported"
  | "security_update";

export interface ClientVersionReport {
  status: ClientVersionStatus;
  /** The package judged: the kit, or the SDK when the kit is current. */
  package: string;
  installed: string;
  latest?: string;
  advisories: Advisory[];
  upgradeGuideUrl?: string;
}

export interface CheckClientVersionsOptions {
  /** Next's config `phase`; the check runs only for `next build`. */
  phase?: string;
  /** The API base, `/api/v1` included. Defaults to production. */
  apiUrl?: string;
  env?: EnvSource;
  timeoutMs?: number;
  fetch?: typeof fetch;
  /** Where the warning goes; `console.warn` by default. */
  warn?: (message: string) => void;
  /** Overrides the baked-in versions (tests). */
  installed?: { kit?: string; sdk?: string };
}

type Semver = [number, number, number];

function parseSemver(v: string | undefined): Semver | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v?.trim() ?? "");
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** True when `a` is a lower version than `b`; false if either isn't semver. */
function isBelow(a: string, b: string | undefined): boolean {
  const x = parseSemver(a);
  const y = parseSemver(b);
  if (!x || !y) return false;
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] < y[i];
  }
  return false;
}

function judge(
  pkg: string,
  installed: string,
  body: VersionsResponse
): ClientVersionReport | null {
  if (!parseSemver(installed)) return null;
  const policy = body.packages?.[pkg];
  if (!policy) return null;
  const advisories = (body.advisories ?? []).filter(
    a => a.package === pkg && isBelow(installed, a.fixed_in)
  );
  const status: ClientVersionStatus = isBelow(installed, policy.security_minimum)
    ? "security_update"
    : isBelow(installed, policy.minimum_supported)
      ? "unsupported"
      : isBelow(installed, policy.latest)
        ? "update_available"
        : "up_to_date";
  return {
    status,
    package: pkg,
    installed,
    latest: policy.latest,
    advisories,
    upgradeGuideUrl: body.upgrade_guide_url,
  };
}

const SEVERITY: Record<ClientVersionStatus, number> = {
  up_to_date: 0,
  update_available: 1,
  unsupported: 2,
  security_update: 3,
};

/**
 * Turns a version report into the multi-line warning that
 * {@link checkClientVersions} prints: the headline, one line per advisory and
 * how to update.
 *
 * @param report - The report to describe.
 * @returns The warning text, ready for `console.warn`.
 */
export function formatClientVersionWarning(report: ClientVersionReport): string {
  const behind = `${report.package} ${report.installed}`;
  const latest = report.latest ? ` (latest ${report.latest})` : "";
  const headline =
    report.status === "security_update"
      ? `ecomweb: security update available: ${behind} has known security issues${latest}.`
      : report.status === "unsupported"
        ? `ecomweb: ${behind} is no longer supported${latest}.`
        : `ecomweb: update available: ${behind}${latest}.`;
  const lines = [headline];
  for (const a of report.advisories) {
    const fixed = a.fixed_in ? ` (fixed in ${a.fixed_in})` : "";
    lines.push(`  - ${a.summary ?? a.id ?? "advisory"}${fixed}`);
  }
  lines.push("  Update with: ecomweb storefront upgrade");
  if (report.upgradeGuideUrl) lines.push(`  Guide: ${report.upgradeGuideUrl}`);
  lines.push("  (Set ECOMWEB_SKIP_VERSION_CHECK=1 to skip this check.)");
  return lines.join("\n");
}

/**
 * Checks the installed kit and SDK against the platform's supported versions
 * and prints a warning when they are behind. For `next.config.mjs`:
 *
 * ```js
 * export default async function config(phase) {
 *   await checkClientVersions({ phase, apiUrl: API_URL });
 *   return nextConfig;
 * }
 * ```
 *
 * Runs during `next build` only, once per build, and never fails or slows it
 * beyond the timeout (2 s): any error is ignored. Off with
 * `ECOMWEB_SKIP_VERSION_CHECK=1`. Returns the report, or null when it did not
 * check.
 */
export async function checkClientVersions(
  options: CheckClientVersionsOptions = {}
): Promise<ClientVersionReport | null> {
  const env = options.env ?? process.env;
  if (options.phase !== PRODUCTION_BUILD_PHASE) return null;
  if (env.ECOMWEB_SKIP_VERSION_CHECK?.trim() === "1") return null;
  if (env[CHECKED_FLAG] === "1") return null;
  env[CHECKED_FLAG] = "1";

  try {
    const base = (options.apiUrl?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
    const doFetch = options.fetch ?? fetch;
    const response = await doFetch(`${base}/public/storefront-clients/versions`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as VersionsResponse;

    const reports = [
      judge(KIT_PACKAGE, options.installed?.kit ?? KIT_VERSION, body),
      judge(SDK_PACKAGE, options.installed?.sdk ?? SDK_VERSION, body),
    ].filter((r): r is ClientVersionReport => r !== null);
    if (reports.length === 0) return null;

    const worst = reports.reduce((a, b) =>
      SEVERITY[b.status] > SEVERITY[a.status] ? b : a
    );
    if (worst.status !== "up_to_date") {
      // A build-time notice for the developer, not runtime logging.
      // eslint-disable-next-line no-console
      (options.warn ?? console.warn)(formatClientVersionWarning(worst));
    }
    return worst;
  } catch {
    return null;
  }
}
