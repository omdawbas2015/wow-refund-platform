import type { CaseStatus, Prisma } from '@wow/db';

/**
 * SLA tiers for open refund cases. Days are inclusive. Terminal statuses
 * (REFUNDED, REJECTED, CANCELLED) bypass the SLA check entirely.
 *
 * The thresholds match the operating SOP:
 *   - 0–2 days  → on track (green)
 *   - 3–5 days  → warning (yellow)
 *   - 6+ days   → breached (red)
 */
export type SlaTier = 'on_track' | 'warning' | 'breached' | 'closed';

const WARNING_AT_DAYS = 3;
const BREACHED_AT_DAYS = 6;

const TERMINAL: ReadonlySet<CaseStatus> = new Set<CaseStatus>([
  'REFUNDED',
  'REJECTED',
  'CANCELLED',
]);

export function isTerminalStatus(status: CaseStatus): boolean {
  return TERMINAL.has(status);
}

/**
 * Return the integer number of days between `createdAt` and `now`. Floored,
 * so a case created 23 hours ago reports `0`.
 */
export function daysSince(createdAt: Date, now: Date = new Date()): number {
  const ms = now.getTime() - createdAt.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function classifySla(
  status: CaseStatus,
  createdAt: Date,
  now: Date = new Date(),
): { tier: SlaTier; days: number } {
  const days = daysSince(createdAt, now);
  if (isTerminalStatus(status)) return { tier: 'closed', days };
  if (days >= BREACHED_AT_DAYS) return { tier: 'breached', days };
  if (days >= WARNING_AT_DAYS) return { tier: 'warning', days };
  return { tier: 'on_track', days };
}

/** Tailwind classes for the dot/badge representing each tier. */
export function slaDotClasses(tier: SlaTier): string {
  switch (tier) {
    case 'breached':
      return 'bg-destructive';
    case 'warning':
      return 'bg-amber-500';
    case 'on_track':
      return 'bg-emerald-500';
    case 'closed':
      return 'bg-muted-foreground/30';
  }
}

export function slaTierLabel(tier: SlaTier): string {
  switch (tier) {
    case 'breached':
      return 'SLA breached';
    case 'warning':
      return 'SLA at risk';
    case 'on_track':
      return 'On track';
    case 'closed':
      return 'Closed';
  }
}

/**
 * Short label for the table cell: e.g. "2d", "5d ⚠", "9d ‼". Keeps the
 * column compact while still conveying the tier.
 */
export function formatSlaCell(tier: SlaTier, days: number): string {
  if (tier === 'closed') return `${days}d`;
  if (tier === 'breached') return `${days}d ‼`;
  if (tier === 'warning') return `${days}d ⚠`;
  return `${days}d`;
}

/**
 * Translate an SLA filter key into Prisma where conditions. The conditions
 * are returned as an array intended to be combined via `AND` so they never
 * collide with an explicit `where.status` set elsewhere in the query.
 *
 * For tier filters (breached / warning / on_track) we always include the
 * `notIn: TERMINAL` constraint. If callers also set `status: 'REFUNDED'`
 * (etc.) at the top level, the AND'd `notIn` correctly returns 0 rows —
 * which is the right answer, since terminal cases are never SLA-tracked.
 */
export function buildSlaConditions(
  sla: SlaTier | 'all',
  now: Date = new Date(),
): Prisma.RefundCaseWhereInput[] {
  if (sla === 'all') return [];
  const dayMs = 24 * 60 * 60 * 1000;
  const TERMINAL_ARR: CaseStatus[] = ['REFUNDED', 'REJECTED', 'CANCELLED'];
  if (sla === 'closed') return [{ status: { in: TERMINAL_ARR } }];
  const notTerminal: Prisma.RefundCaseWhereInput = { status: { notIn: TERMINAL_ARR } };
  if (sla === 'breached') {
    return [
      notTerminal,
      { createdAt: { lte: new Date(now.getTime() - BREACHED_AT_DAYS * dayMs) } },
    ];
  }
  if (sla === 'warning') {
    return [
      notTerminal,
      {
        createdAt: {
          lte: new Date(now.getTime() - WARNING_AT_DAYS * dayMs),
          gt: new Date(now.getTime() - BREACHED_AT_DAYS * dayMs),
        },
      },
    ];
  }
  // on_track
  return [
    notTerminal,
    { createdAt: { gt: new Date(now.getTime() - WARNING_AT_DAYS * dayMs) } },
  ];
}

/** Coerce an arbitrary string param into a known SLA tier or 'all'. */
export function parseSlaParam(raw: string | undefined): SlaTier | 'all' {
  const v = (raw ?? '').toLowerCase();
  if (v === 'breached' || v === 'warning' || v === 'on_track' || v === 'closed') return v;
  return 'all';
}
