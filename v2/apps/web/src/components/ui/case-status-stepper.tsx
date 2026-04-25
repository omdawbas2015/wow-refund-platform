import { Check, X, Ban, Clock } from 'lucide-react';
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

  // Index of the "current" step on the main rail
  const stepIndex: Record<CaseStatus, number> = {
    DRAFT: 0,
    PENDING_APPROVAL: 1,
    APPROVED: 2,
    IN_EXECUTION: 3,
    PARTIALLY_REFUNDED: 3, // sits on "In execution" step but annotated
    REFUNDED: 4,
    REJECTED: 1, // rejected happens at approval step
    CANCELLED: 0,
  };

  const states = {} as Record<CaseStatus, StepState>;
  const currentIdx = stepIndex[status];
  STEPS.forEach((s, i) => {
    if (i < currentIdx) states[s.key] = 'done';
    else if (i === currentIdx) states[s.key] = 'current';
    else states[s.key] = 'upcoming';
  });

  // On terminal non-success states, later steps stay upcoming and the current is visually red
  // On REFUNDED, all mark as done
  if (status === 'REFUNDED') {
    STEPS.forEach((s) => (states[s.key] = 'done'));
  }

  return { states, terminal, partial };
}

export function CaseStatusStepper({
  status,
  locale = 'en',
  className,
}: {
  status: CaseStatus;
  locale?: string;
  className?: string;
}) {
  const { states, terminal, partial } = computeStates(status);
  const isAr = locale === 'ar';

  return (
    <div className={cn('rounded-lg border border-border bg-surface p-5', className)}>
      <div className="flex items-center justify-between gap-2">
        {STEPS.map((step, idx) => {
          const state = states[step.key];
          const label = isAr ? step.labelAr : step.label;

          const isLast = idx === STEPS.length - 1;

          // Rejected/Cancelled visual override on the "current" node
          const isTerminalHere =
            (terminal === 'rejected' && step.key === 'PENDING_APPROVAL') ||
            (terminal === 'cancelled' && state === 'current');

          return (
            <div key={step.key} className="flex flex-1 items-center">
              {/* Node */}
              <div className="flex flex-col items-center gap-2">
                <div
                  aria-current={state === 'current' ? 'step' : undefined}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all',
                    state === 'done' &&
                      !isTerminalHere &&
                      'border-primary bg-primary text-primary-foreground',
                    state === 'current' &&
                      !isTerminalHere &&
                      'border-primary bg-primary/10 text-primary ring-4 ring-primary/10',
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
                  {state === 'done' && !isTerminalHere && <Check className="h-4 w-4" />}
                  {state === 'current' && !isTerminalHere && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                  {state === 'upcoming' && !isTerminalHere && (
                    <span className="text-xs font-medium">{idx + 1}</span>
                  )}
                  {isTerminalHere && terminal === 'rejected' && <X className="h-4 w-4" />}
                  {isTerminalHere && terminal === 'cancelled' && <Ban className="h-4 w-4" />}
                </div>
                <div
                  className={cn(
                    'whitespace-nowrap text-xs font-medium',
                    state === 'current' && !isTerminalHere && 'text-primary',
                    state === 'done' && !isTerminalHere && 'text-heading',
                    state === 'upcoming' && !isTerminalHere && 'text-muted-foreground',
                    isTerminalHere && terminal === 'rejected' && 'text-destructive',
                    isTerminalHere && terminal === 'cancelled' && 'text-muted-foreground',
                  )}
                >
                  {label}
                </div>
              </div>

              {/* Connector */}
              {!isLast && (() => {
                const curr = STEPS[idx];
                const next = STEPS[idx + 1];
                if (!curr || !next) return null;
                const isConnectorDone =
                  states[curr.key] === 'done' && states[next.key] !== 'upcoming';
                return (
                  <div className="mx-2 h-0.5 flex-1">
                    <div
                      className={cn(
                        'h-full w-full rounded-full',
                        isConnectorDone ? 'bg-primary' : 'bg-border',
                        partial &&
                          curr.key === 'IN_EXECUTION' &&
                          'bg-transparent border-t-2 border-dashed border-primary/60',
                      )}
                    />
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Badge strip for special states */}
      {(terminal || partial) && (
        <div className="mt-4 flex items-center gap-2">
          {terminal === 'rejected' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-3 py-1 text-xs font-medium text-destructive">
              <X className="h-3 w-3" />
              {isAr ? 'مرفوض' : 'Rejected'}
            </span>
          )}
          {terminal === 'cancelled' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <Ban className="h-3 w-3" />
              {isAr ? 'ملغى' : 'Cancelled'}
            </span>
          )}
          {partial && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Clock className="h-3 w-3" />
              {isAr ? 'استرداد جزئي' : 'Partially refunded'}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Compact 5-dot status stepper for dense surfaces (tables, cards).
 */
export function CaseStatusMiniStepper({
  status,
  className,
}: {
  status: CaseStatus;
  className?: string;
}) {
  const { states, terminal, partial } = computeStates(status);

  return (
    <div className={cn('flex items-center gap-1', className)} aria-label={`status: ${status}`}>
      {STEPS.map((step, idx) => {
        const state = states[step.key];
        const isTerminalHere =
          (terminal === 'rejected' && step.key === 'PENDING_APPROVAL') ||
          (terminal === 'cancelled' && state === 'current');

        return (
          <div key={step.key} className="flex items-center">
            <span
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                state === 'done' && !isTerminalHere && 'bg-primary',
                state === 'current' &&
                  !isTerminalHere &&
                  'bg-primary ring-2 ring-primary/25',
                state === 'upcoming' && 'bg-border',
                isTerminalHere && terminal === 'rejected' && 'bg-destructive',
                isTerminalHere && terminal === 'cancelled' && 'bg-muted-foreground',
              )}
            />
            {(() => {
              if (idx >= STEPS.length - 1) return null;
              const curr = STEPS[idx];
              const next = STEPS[idx + 1];
              if (!curr || !next) return null;
              const isConnectorDone =
                states[curr.key] === 'done' && states[next.key] !== 'upcoming';
              return (
                <span
                  className={cn(
                    'mx-0.5 h-px w-2',
                    isConnectorDone ? 'bg-primary' : 'bg-border',
                    partial &&
                      curr.key === 'IN_EXECUTION' &&
                      'bg-transparent border-t border-dashed border-primary/60',
                  )}
                />
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
