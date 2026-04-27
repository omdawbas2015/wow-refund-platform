import type { SlaRule } from '@wow/db';

export interface SlaScope {
  countryId: string | null;
  brandId: string | null;
  rootCauseId: string | null;
}

export interface ResolvedSla {
  rule: SlaRule | null;
  thresholdHours: number;
  warningHours: number | null;
}

/**
 * Default thresholds used when no SLA rule matches a case. These match the
 * day-based tiers in `lib/cases/sla.ts` (warning at 3 days, breach at 6 days)
 * so the rule-aware path stays consistent with the legacy classifier when
 * the rules table is empty.
 */
export const DEFAULT_THRESHOLD_HOURS = 6 * 24;
export const DEFAULT_WARNING_HOURS = 3 * 24;

/**
 * Most-specific-first match: a rule wins when more of its scope filters
 * match the case. Ties are broken by rule.name (stable). Inactive rules are
 * never considered.
 */
export function pickSlaRule(rules: SlaRule[], scope: SlaScope): ResolvedSla {
  const candidates = rules
    .filter((r) => r.isActive)
    .filter((r) => r.countryId === null || r.countryId === scope.countryId)
    .filter((r) => r.brandId === null || r.brandId === scope.brandId)
    .filter((r) => r.rootCauseId === null || r.rootCauseId === scope.rootCauseId);

  if (candidates.length === 0) {
    return {
      rule: null,
      thresholdHours: DEFAULT_THRESHOLD_HOURS,
      warningHours: DEFAULT_WARNING_HOURS,
    };
  }

  const score = (r: SlaRule) =>
    (r.countryId !== null ? 4 : 0) +
    (r.brandId !== null ? 2 : 0) +
    (r.rootCauseId !== null ? 1 : 0);

  const best = candidates.reduce((acc, r) => {
    if (!acc) return r;
    const sa = score(acc);
    const sr = score(r);
    if (sr !== sa) return sr > sa ? r : acc;
    return r.name < acc.name ? r : acc;
  }, candidates[0]!);

  return {
    rule: best,
    thresholdHours: best.thresholdHours,
    warningHours: best.warningHours,
  };
}

export type SlaTierHours = 'on_track' | 'warning' | 'breached';

export function classifyByHours(
  elapsedHours: number,
  resolved: ResolvedSla,
): SlaTierHours {
  if (elapsedHours >= resolved.thresholdHours) return 'breached';
  if (
    resolved.warningHours !== null &&
    elapsedHours >= resolved.warningHours
  ) {
    return 'warning';
  }
  return 'on_track';
}

export function hoursBetween(from: Date, to: Date = new Date()): number {
  return Math.max(0, (to.getTime() - from.getTime()) / (1000 * 60 * 60));
}
