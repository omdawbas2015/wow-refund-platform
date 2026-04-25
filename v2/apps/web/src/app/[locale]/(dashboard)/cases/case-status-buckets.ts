/**
 * UI-level grouping of the full case state machine. Shared between the
 * server page (for filtering + counts) and the client filter bar.
 *
 * The underlying state machine is defined in @wow/validators and is not
 * collapsed — ops still sees the exact status on each row. These buckets
 * just let users scan "what needs my attention" vs "what's already done".
 */
export const STATUS_BUCKETS = {
  open: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION'],
  resolved: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  closed: ['REJECTED', 'CANCELLED'],
} as const;

export type StatusBucket = keyof typeof STATUS_BUCKETS;

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  IN_EXECUTION: 'In execution',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};
