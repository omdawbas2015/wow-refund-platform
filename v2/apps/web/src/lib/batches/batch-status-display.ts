import type { BatchStatus, KnetBatchStatus } from '@wow/db';

type Variant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline';

export function approvalBatchVariant(status: BatchStatus): Variant {
  switch (status) {
    case 'DRAFT':
      return 'outline';
    case 'SENT':
    case 'AWAITING_RESPONSE':
      return 'warning';
    case 'PARTIALLY_DECIDED':
      return 'warning';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'secondary';
  }
}

export function approvalBatchLabel(status: BatchStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'SENT':
      return 'Sent';
    case 'AWAITING_RESPONSE':
      return 'Awaiting reply';
    case 'PARTIALLY_DECIDED':
      return 'Partial';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
  }
}

export function knetBatchVariant(status: KnetBatchStatus): Variant {
  switch (status) {
    case 'DRAFT':
      return 'outline';
    case 'SENT':
    case 'AWAITING_ARNS':
      return 'warning';
    case 'ARNS_RECEIVED':
      return 'default';
    case 'COMPLETED':
      return 'success';
    case 'CANCELLED':
      return 'secondary';
  }
}

export function knetBatchLabel(status: KnetBatchStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Draft';
    case 'SENT':
      return 'Sent';
    case 'AWAITING_ARNS':
      return 'Awaiting ARNs';
    case 'ARNS_RECEIVED':
      return 'ARNs received';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
  }
}
