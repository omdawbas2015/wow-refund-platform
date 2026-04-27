/**
 * Tiny 5-field cron parser & evaluator. Supports:
 *   - `*` (any value in range)
 *   - `*\/N` (every N steps)
 *   - lists `1,5,10`
 *   - ranges `1-5`
 *   - bare numbers `0`
 *
 * Fields, in order: minute (0-59) hour (0-23) dom (1-31) month (1-12) dow (0-6, Sun=0).
 *
 * Why not pull in `cron-parser`/`croner`? Workspace is already opinionated
 * about deps; this is ~60 lines and covers the common cases admins use
 * for scheduled reports (hourly, weekday mornings, day-of-month, etc.).
 */

type FieldRange = { min: number; max: number };

const FIELD_RANGES: FieldRange[] = [
  { min: 0, max: 59 }, // minute
  { min: 0, max: 23 }, // hour
  { min: 1, max: 31 }, // day of month
  { min: 1, max: 12 }, // month
  { min: 0, max: 6 }, // day of week
];

function expandField(raw: string, range: FieldRange): Set<number> {
  const result = new Set<number>();
  const parts = raw.split(',');
  for (const part of parts) {
    let stepMatch = part.match(/^(.+)\/(\d+)$/);
    let step = 1;
    let body = part;
    if (stepMatch) {
      body = stepMatch[1]!;
      step = Math.max(1, parseInt(stepMatch[2]!, 10));
    }
    let lo = range.min;
    let hi = range.max;
    if (body !== '*') {
      const rangeMatch = body.match(/^(\d+)-(\d+)$/);
      if (rangeMatch) {
        lo = parseInt(rangeMatch[1]!, 10);
        hi = parseInt(rangeMatch[2]!, 10);
      } else {
        const single = parseInt(body, 10);
        if (Number.isNaN(single)) {
          throw new Error(`Invalid cron field segment: ${part}`);
        }
        lo = hi = single;
      }
    }
    if (lo < range.min || hi > range.max || lo > hi) {
      throw new Error(`Cron field out of range: ${part}`);
    }
    for (let v = lo; v <= hi; v += step) result.add(v);
  }
  return result;
}

export interface CronSpec {
  minute: Set<number>;
  hour: Set<number>;
  dom: Set<number>;
  month: Set<number>;
  dow: Set<number>;
}

export function parseCron(expr: string): CronSpec {
  const fields = expr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error(`Cron must have 5 fields, got ${fields.length}: ${expr}`);
  }
  return {
    minute: expandField(fields[0]!, FIELD_RANGES[0]!),
    hour: expandField(fields[1]!, FIELD_RANGES[1]!),
    dom: expandField(fields[2]!, FIELD_RANGES[2]!),
    month: expandField(fields[3]!, FIELD_RANGES[3]!),
    dow: expandField(fields[4]!, FIELD_RANGES[4]!),
  };
}

/**
 * Returns true if the cron expression matches `at` (treated as UTC). For
 * day-of-month + day-of-week, we use the conventional "OR" semantics that
 * matches both Vixie cron and Vercel: when one of dom/dow is restricted and
 * the other is `*`, only the restricted one matters.
 */
export function cronMatches(spec: CronSpec, at: Date): boolean {
  const m = at.getUTCMinutes();
  const h = at.getUTCHours();
  const d = at.getUTCDate();
  const mo = at.getUTCMonth() + 1;
  const dw = at.getUTCDay();

  if (!spec.minute.has(m)) return false;
  if (!spec.hour.has(h)) return false;
  if (!spec.month.has(mo)) return false;

  const domAny = spec.dom.size === 31;
  const dowAny = spec.dow.size === 7;
  if (domAny && dowAny) return true;
  if (!domAny && dowAny) return spec.dom.has(d);
  if (domAny && !dowAny) return spec.dow.has(dw);
  return spec.dom.has(d) || spec.dow.has(dw);
}

/**
 * Returns true if there is at least one minute boundary in (since, now]
 * that matches the cron expression. Capped at 14 days of look-back so a
 * never-run report doesn't blow up the loop the first time the cron fires.
 */
export function isDueSince(
  spec: CronSpec,
  since: Date | null,
  now: Date,
): boolean {
  const MAX_MINUTES = 60 * 24 * 14;
  const start = since
    ? new Date(Math.floor(since.getTime() / 60000) * 60000 + 60000)
    : new Date(now.getTime() - MAX_MINUTES * 60000);
  const end = new Date(Math.floor(now.getTime() / 60000) * 60000);
  let cursor = start.getTime();
  let steps = 0;
  while (cursor <= end.getTime() && steps < MAX_MINUTES) {
    const at = new Date(cursor);
    if (cronMatches(spec, at)) return true;
    cursor += 60_000;
    steps += 1;
  }
  return false;
}

/**
 * Validate a cron expression — used by the create/update server actions
 * before persisting. Returns null on success, an error message on failure.
 */
export function validateCron(expr: string): string | null {
  try {
    parseCron(expr);
    return null;
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
