import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type StatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

interface StatusBadgeProps {
  variant?: StatusVariant;
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

const variantStyles: Record<StatusVariant, string> = {
  success: 'bg-[var(--color-success-subtle)] text-[var(--color-success-text)] border-[var(--color-success-subtle)]',
  warning: 'bg-[var(--color-warning-subtle)] text-[var(--color-warning-text)] border-[var(--color-warning-subtle)]',
  danger:  'bg-[var(--color-danger-subtle)] text-[var(--color-danger-text)] border-[var(--color-danger-subtle)]',
  info:    'bg-[var(--color-info-subtle)] text-[var(--color-info-text)] border-[var(--color-info-subtle)]',
  neutral: 'bg-[var(--color-neutral-subtle)] text-[var(--color-neutral-text)] border-[var(--color-neutral-subtle)]',
  accent:  'bg-[var(--color-accent-subtle)] text-[var(--color-accent)] border-[var(--color-accent-subtle)]',
};

const dotStyles: Record<StatusVariant, string> = {
  success: 'bg-[var(--color-success)]',
  warning: 'bg-[var(--color-warning)]',
  danger:  'bg-[var(--color-danger)]',
  info:    'bg-[var(--color-info)]',
  neutral: 'bg-[var(--color-neutral)]',
  accent:  'bg-[var(--color-accent)]',
};

/** Maps refund statuses to badge variants */
export function getStatusVariant(status: string): StatusVariant {
  const s = status.toUpperCase().replace(/[\s-]+/g, '_');
  if (['REFUNDED', 'COMPLETED', 'KNET_REFUNDED', 'AURA_REFUNDED'].includes(s)) return 'success';
  if (['PENDING_APPROVAL', 'PENDING', 'DRAFT', 'PENDING_EXECUTION'].includes(s)) return 'warning';
  if (['FAILED', 'REJECTED', 'EXPIRED'].includes(s)) return 'danger';
  if (['APPROVED', 'PENDING_REFUND', 'PENDING_KNET', 'KNET_PENDING', 'AURA_PENDING', 'PROCESSING_EXECUTION', 'PENDING_EXTERNAL'].includes(s)) return 'info';
  if (['PARTIALLY_REFUNDED'].includes(s)) return 'accent';
  return 'neutral';
}

/** Formats raw status strings for display */
export function formatStatus(status: string): string {
  const map: Record<string, string> = {
    'DRAFT': 'Draft',
    'PENDING_APPROVAL': 'Pending Approval',
    'APPROVED': 'Approved',
    'PENDING_REFUND': 'Awaiting Refund',
    'PENDING_KNET': 'Awaiting KNET',
    'KNET_PENDING': 'Awaiting KNET',
    'KNET-PENDING REFUND': 'KNET Processing',
    'KNET-MANUAL REFUND': 'KNET Manual',
    'KNET_REFUNDED': 'KNET Refunded',
    'AURA_PENDING': 'Awaiting Aura',
    'AURA_REFUNDED': 'Aura Confirmed',
    'PENDING_EXTERNAL': 'External Pending',
    'PROCESSING_EXECUTION': 'Processing',
    'PARTIALLY_REFUNDED': 'Partially Refunded',
    'REFUNDED': 'Refunded',
    'PENDING_EXECUTION': 'Pending Execution',
    'COMPLETED': 'Completed',
    'FAILED': 'Failed',
    'REJECTED': 'Rejected',
  };
  return map[status] || status.replace(/[_-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function StatusBadge({ variant = 'neutral', children, dot = false, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[var(--radius-sm)] text-[11px] font-semibold border leading-none whitespace-nowrap',
        variantStyles[variant],
        className
      )}
    >
      {dot && (
        <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dotStyles[variant])} />
      )}
      {children}
    </span>
  );
}

/** Convenience: auto-detect variant from status string */
export function RefundStatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <StatusBadge variant={getStatusVariant(status)} dot className={className}>
      {formatStatus(status)}
    </StatusBadge>
  );
}
