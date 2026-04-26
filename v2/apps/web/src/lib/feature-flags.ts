import { prisma } from '@wow/db';

/**
 * Look up a feature flag by key. Returns `false` when the flag is missing
 * (closed-by-default semantics) or when the DB read fails (e.g. during build
 * with no DB available — keeps SSR resilient).
 */
export async function isFeatureEnabled(key: string, fallback = false): Promise<boolean> {
  try {
    const flag = await prisma.featureFlag.findUnique({ where: { key } });
    return flag?.enabled ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Bulk-read several feature flags in one round-trip.
 */
export async function readFeatureFlags(
  keys: string[],
  fallback = false,
): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = Object.fromEntries(keys.map((k) => [k, fallback]));
  if (keys.length === 0) return result;
  try {
    const rows = await prisma.featureFlag.findMany({ where: { key: { in: keys } } });
    for (const row of rows) {
      result[row.key] = row.enabled;
    }
  } catch {
    // swallow — return fallback values
  }
  return result;
}
