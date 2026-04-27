import { classifySla, slaDotClasses, slaTierLabel, formatSlaCell } from '@/lib/cases/sla';
import type { CaseStatus } from '@wow/db';
import { cn } from '@/lib/utils';

interface SlaPillProps {
  status: CaseStatus;
  createdAt: Date;
  /** When true, renders only a colored dot + days, no label. */
  compact?: boolean;
}

/**
 * Inline indicator showing how long a case has been open and which SLA tier
 * it falls into. Renders a colored dot plus the integer days; the full tier
 * label is exposed via `title=` for desktop hover (and screen readers).
 */
export function SlaPill({ status, createdAt, compact = true }: SlaPillProps) {
  const { tier, days } = classifySla(status, createdAt);
  const cell = formatSlaCell(tier, days);
  const label = slaTierLabel(tier);
  return (
    <span
      title={label}
      aria-label={`${label} (${days} days)`}
      className={cn(
        'inline-flex items-center gap-1.5 tabular-nums',
        tier === 'breached' && 'text-destructive',
        tier === 'warning' && 'text-amber-700 dark:text-amber-400',
      )}
    >
      <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', slaDotClasses(tier))} />
      <span className="text-xs">{cell}</span>
      {compact ? null : <span className="text-xs text-muted-foreground">· {label}</span>}
    </span>
  );
}
