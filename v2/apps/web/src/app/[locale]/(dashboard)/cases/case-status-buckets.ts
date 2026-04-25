/**
 * UI-level grouping of the full case state machine. Shared between the
 * server page (for filtering + counts) and the client filter bar.
 *
 * Three mutually-exclusive buckets, each with a concrete meaning:
 *   - active   → still being worked on (needs attention)
 *   - refunded → money moved back to the customer (fully or partially)
 *   - closed   → finished without a refund (rejected / cancelled)
 *
 * The underlying state machine is NOT collapsed: rows still show their
 * exact status. Buckets are only a scanning aid in the filter bar.
 */
export const STATUS_BUCKETS = {
  active: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION'],
  refunded: ['REFUNDED', 'PARTIALLY_REFUNDED'],
  closed: ['REJECTED', 'CANCELLED'],
} as const;

export type StatusBucket = keyof typeof STATUS_BUCKETS;

export const STATUS_BUCKET_LABELS: Record<StatusBucket, string> = {
  active: 'Active',
  refunded: 'Refunded',
  closed: 'Closed',
};

/** Short helper copy shown under each tab in the filter bar. */
export const STATUS_BUCKET_DESCRIPTIONS: Record<StatusBucket, string> = {
  active: 'Needs action — draft, approval, execution',
  refunded: 'Refund already sent to the customer',
  closed: 'Rejected or cancelled — no refund',
};

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
