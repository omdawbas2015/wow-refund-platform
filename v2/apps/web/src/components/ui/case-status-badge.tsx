import { cn } from '@/lib/utils';

/**
 * Unified status pill — soft tonal background + leading colored dot.
 * Inspired by Linear / Stripe / Vercel: every state uses the same shape
 * so the eye scans status by hue, not by silhouette. Draft is a real
 * pill (not plain text) so the column reads as a single grid.
 */
type Tone = {
  dot: string;
  bg: string;
  text: string;
  label: string;
};

const CASE_TONES: Record<string, Tone> = {
  DRAFT: {
    dot: 'bg-zinc-400',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-700 dark:text-zinc-300',
    label: 'Draft',
  },
  PENDING_APPROVAL: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Pending approval',
  },
  APPROVED: {
    dot: 'bg-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'Approved',
  },
  IN_EXECUTION: {
    dot: 'bg-violet-500',
    bg: 'bg-violet-500/10',
    text: 'text-violet-700 dark:text-violet-400',
    label: 'In execution',
  },
  PARTIALLY_REFUNDED: {
    dot: 'bg-teal-500',
    bg: 'bg-teal-500/10',
    text: 'text-teal-700 dark:text-teal-400',
    label: 'Partially refunded',
  },
  REFUNDED: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Refunded',
  },
  REJECTED: {
    dot: 'bg-rose-500',
    bg: 'bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-400',
    label: 'Rejected',
  },
  CANCELLED: {
    dot: 'bg-zinc-400',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-700 dark:text-zinc-300',
    label: 'Cancelled',
  },
};

const COMPONENT_TONES: Record<string, Tone> = {
  PENDING: {
    dot: 'bg-zinc-400',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-700 dark:text-zinc-300',
    label: 'Pending',
  },
  AWAITING_BATCH: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Awaiting batch',
  },
  AWAITING_ARN: {
    dot: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-400',
    label: 'Awaiting ARN',
  },
  ARN_RECEIVED: {
    dot: 'bg-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-700 dark:text-blue-400',
    label: 'ARN received',
  },
  REFUNDED: {
    dot: 'bg-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-700 dark:text-emerald-400',
    label: 'Refunded',
  },
  FAILED: {
    dot: 'bg-rose-500',
    bg: 'bg-rose-500/10',
    text: 'text-rose-700 dark:text-rose-400',
    label: 'Failed',
  },
};

function StatusPill({ tone, className }: { tone: Tone; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
        tone.bg,
        tone.text,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} aria-hidden />
      {tone.label}
    </span>
  );
}

export function CaseStatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = CASE_TONES[status] ?? {
    dot: 'bg-zinc-400',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-700 dark:text-zinc-300',
    label: status,
  };
  return <StatusPill tone={tone} className={className} />;
}

export function ComponentStatusBadge({ status, className }: { status: string; className?: string }) {
  const tone = COMPONENT_TONES[status] ?? {
    dot: 'bg-zinc-400',
    bg: 'bg-zinc-500/10',
    text: 'text-zinc-700 dark:text-zinc-300',
    label: status,
  };
  return <StatusPill tone={tone} className={className} />;
}
