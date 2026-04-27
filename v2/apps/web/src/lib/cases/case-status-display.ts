import type { CaseStatus, ComponentStatus, AuraStatus } from '@wow/db';

type Variant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline';

export function caseStatusVariant(status: CaseStatus): Variant {
  switch (status) {
    case 'DRAFT':
      return 'outline';
    case 'PENDING_APPROVAL':
      return 'warning';
    case 'APPROVED':
      return 'default';
    case 'IN_EXECUTION':
      return 'default';
    case 'PARTIALLY_REFUNDED':
      return 'warning';
    case 'REFUNDED':
      return 'success';
    case 'REJECTED':
      return 'destructive';
    case 'CANCELLED':
      return 'secondary';
    default:
      return 'secondary';
  }
}

export function caseStatusLabel(status: CaseStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'PENDING_APPROVAL':
      return 'Pending approval';
    case 'APPROVED':
      return 'Approved';
    case 'IN_EXECUTION':
      return 'In execution';
    case 'PARTIALLY_REFUNDED':
      return 'Partial';
    case 'REFUNDED':
      return 'Refunded';
    case 'REJECTED':
      return 'Rejected';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

export function componentStatusVariant(status: ComponentStatus): Variant {
  switch (status) {
    case 'PENDING':
    case 'AWAITING_BATCH':
      return 'outline';
    case 'AWAITING_ARN':
    case 'ARN_RECEIVED':
      return 'warning';
    case 'REFUNDED':
      return 'success';
    case 'FAILED':
      return 'destructive';
  }
}

export function componentStatusLabel(status: ComponentStatus): string {
  switch (status) {
    case 'PENDING':
      return 'Pending';
    case 'AWAITING_BATCH':
      return 'Awaiting batch';
    case 'AWAITING_ARN':
      return 'Awaiting ARN';
    case 'ARN_RECEIVED':
      return 'ARN received';
    case 'REFUNDED':
      return 'Refunded';
    case 'FAILED':
      return 'Failed';
  }
}

export function auraStatusLabel(status: AuraStatus): string {
  switch (status) {
    case 'NONE':
      return '—';
    case 'PENDING':
      return 'Pending';
    case 'IN_BATCH':
      return 'In batch';
    case 'COMPLETED':
      return 'Completed';
    case 'FAILED':
      return 'Failed';
    default:
      return '—';
  }
}
