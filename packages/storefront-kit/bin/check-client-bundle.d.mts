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
