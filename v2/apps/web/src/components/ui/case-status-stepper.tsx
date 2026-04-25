'use client';

import { Check, X, Ban, Clock, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CaseStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_EXECUTION'
  | 'PARTIALLY_REFUNDED'
  | 'REFUNDED'
  | 'REJECTED'
  | 'CANCELLED';

const STEPS: { key: CaseStatus; label: string; labelAr: string }[] = [
  { key: 'DRAFT', label: 'Draft', labelAr: 'مسودة' },
  { key: 'PENDING_APPROVAL', label: 'Pending approval', labelAr: 'قيد الموافقة' },
  { key: 'APPROVED', label: 'Approved', labelAr: 'تمت الموافقة' },
  { key: 'IN_EXECUTION', label: 'In execution', labelAr: 'قيد التنفيذ' },
  { key: 'REFUNDED', label: 'Refunded', labelAr: 'تم الاسترداد' },
];

type StepState = 'done' | 'current' | 'upcoming';

function computeStates(status: CaseStatus): {
  states: Record<CaseStatus, StepState>;
  terminal: 'rejected' | 'cancelled' | null;
  partial: boolean;
} {
  const terminal =
    status === 'REJECTED' ? 'rejected' : status === 'CANCELLED' ? 'cancelled' : null;
  const partial = status === 'PARTIALLY_REFUNDED';

  const stepIndex: Record<CaseStatus, number> = {
    DRAFT: 0,
    PENDING_APPROVAL: 1,
    APPROVED: 2,
    IN_EXECUTION: 3,
    PARTIALLY_REFUNDED: 3,
    REFUNDED: 4,
    // REJECTED can only fire from PENDING_APPROVAL per the state machine,
    // so 1 is an accurate "rejected at pending approval" position.
    REJECTED: 1,
    // CANCELLED can happen from any non-terminal step; we don't carry the
    // originating status on the case, so we dim the entire trail and rely
    // on the "Cancelled" pill above the stepper. Sentinel -1 means "no
    // current step" — no trail position is marked as current or done.
    CANCELLED: -1,
  };

  const states = {} as Record<CaseStatus, StepState>;
  const currentIdx = stepIndex[status];
  STEPS.forEach((s, i) => {
    if (currentIdx < 0) states[s.key] = 'upcoming';
    else if (i < currentIdx) states[s.key] = 'done';
    else if (i === currentIdx) states[s.key] = 'current';
    else states[s.key] = 'upcoming';
  });

  if (status === 'REFUNDED') {
    STEPS.forEach((s) => (states[s.key] = 'done'));
  }

  return { states, terminal, partial };
}

/**
 * Compact vertical case-status stepper with subtle animations.
 * Designed for the right rail on the case detail page and drawer.
 */
export function CaseStatusStepper({
  status,
  locale = 'en',
  className,
  deleted = false,
}: {
  status: CaseStatus;
  locale?: string;
  className?: string;
  deleted?: boolean;
}) {
  const { states, terminal, partial } = computeStates(status);
  const isAr = locale === 'ar';

  // If deleted, we override everything with a simple "Deleted" pill + dimmed trail.
  if (deleted) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-surface-subtle/40 p-4',
          className,
        )}
      >
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
          <Trash2 className="h-3 w-3" />
          {isAr ? 'محذوف' : 'Deleted'}
        </div>
        <VerticalRail states={states} locale={locale} terminal={null} partial={false} dimmed />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-surface p-4',
        className,
      )}
    >
      {(terminal || partial) && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {terminal === 'rejected' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-1 text-xs font-medium text-destructive">
              <X className="h-3 w-3" />
              {isAr ? 'مرفوض' : 'Rejected'}
            </span>
          )}
          {terminal === 'cancelled' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Ban className="h-3 w-3" />
              {isAr ? 'ملغى' : 'Cancelled'}
            </span>
          )}
          {partial && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              <Clock className="h-3 w-3" />
              {isAr ? 'استرداد جزئي' : 'Partially refunded'}
            </span>
          )}
        </div>
      )}
      <VerticalRail states={states} locale={locale} terminal={terminal} partial={partial} />
    </div>
  );
}

function VerticalRail({
  states,
  locale,
  terminal,
  partial,
  dimmed = false,
}: {
  states: Record<CaseStatus, StepState>;
  locale: string;
  terminal: 'rejected' | 'cancelled' | null;
  partial: boolean;
  dimmed?: boolean;
}) {
  const isAr = locale === 'ar';
  return (
    <ol className={cn('relative space-y-0', dimmed && 'opacity-60')}>
      {STEPS.map((step, idx) => {
        const state = states[step.key];
        const label = isAr ? step.labelAr : step.label;
        const isLast = idx === STEPS.length - 1;

        const isTerminalHere =
          (terminal === 'rejected' && step.key === 'PENDING_APPROVAL') ||
          (terminal === 'cancelled' && state === 'current');

        const curr = STEPS[idx];
        const next = STEPS[idx + 1];
        const connectorDone =
          !isLast && curr && next
            ? states[curr.key] === 'done' && states[next.key] !== 'upcoming'
            : false;
        const connectorDashed =
          !isLast && partial && curr?.key === 'IN_EXECUTION';

        return (
          <li key={step.key} className="relative flex gap-3 pb-3 last:pb-0">
            {/* Vertical connector (rendered behind) */}
            {!isLast && (
              <span
                aria-hidden
                className={cn(
                  'absolute start-3 top-6 h-[calc(100%-1.25rem)] w-px',
                  connectorDashed
                    ? 'border-s border-dashed border-primary/50 bg-transparent'
                    : connectorDone
                      ? 'bg-primary'
                      : 'bg-border',
                )}
              />
            )}

            {/* Node */}
            <div
              className={cn(
                'relative z-10 flex h-6 w-6 flex-none items-center justify-center rounded-full border transition-all duration-300',
                state === 'done' &&
                  !isTerminalHere &&
                  'border-primary bg-primary text-primary-foreground scale-100',
                state === 'current' &&
                  !isTerminalHere &&
                  'border-primary bg-surface text-primary ring-4 ring-primary/15 animate-pulse-ring',
                state === 'upcoming' &&
                  'border-border bg-surface text-muted-foreground',
                isTerminalHere &&
                  terminal === 'rejected' &&
                  'border-destructive bg-destructive text-destructive-foreground',
                isTerminalHere &&
                  terminal === 'cancelled' &&
                  'border-muted-foreground bg-muted text-muted-foreground',
              )}
            >
              {state === 'done' && !isTerminalHere && (
                <Check className="h-3 w-3" strokeWidth={3} />
              )}
              {state === 'current' && !isTerminalHere && (
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              )}
              {state === 'upcoming' && !isTerminalHere && (
                <span className="text-[10px] font-medium">{idx + 1}</span>
              )}
              {isTerminalHere && terminal === 'rejected' && (
                <X className="h-3 w-3" strokeWidth={3} />
              )}
              {isTerminalHere && terminal === 'cancelled' && (
                <Ban className="h-3 w-3" strokeWidth={2.5} />
              )}
            </div>

            {/* Label */}
            <div className="flex-1 pt-0.5">
              <div
                className={cn(
                  'text-sm leading-6 transition-colors',
                  state === 'current' && !isTerminalHere && 'font-semibold text-heading',
                  state === 'done' && !isTerminalHere && 'font-medium text-heading',
                  state === 'upcoming' && 'text-muted-foreground',
                  isTerminalHere && terminal === 'rejected' && 'font-semibold text-destructive',
                  isTerminalHere && terminal === 'cancelled' && 'font-semibold text-muted-foreground',
                )}
              >
                {label}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
