/**
 * Scans a Next.js build output for secrets that reached client code.
 *
 * @param nextDir - the `.next` directory
 * @param env - environment to match exact secret values from
 * @returns one `"<relative file>: <what matched>"` line per hit; never the value
 */
export function findSecretsInClientBundle(
  nextDir: string,
  env: Record<string, string | undefined>,
): string[];

/**
 * CLI body: checks `argv[0]` (default `.next`) and exits 1 on a hit or a missing directory.
 */
export function main(argv?: string[], env?: Record<string, string | undefined>): void;
