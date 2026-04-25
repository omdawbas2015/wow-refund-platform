import { Badge } from './badge';

const MAP: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'; label: string }> = {
  DRAFT: { variant: 'outline', label: 'Draft' },
  PENDING_APPROVAL: { variant: 'warning', label: 'Pending approval' },
  APPROVED: { variant: 'default', label: 'Approved' },
  IN_EXECUTION: { variant: 'default', label: 'In execution' },
  PARTIALLY_REFUNDED: { variant: 'secondary', label: 'Partially refunded' },
  REFUNDED: { variant: 'success', label: 'Refunded' },
  REJECTED: { variant: 'destructive', label: 'Rejected' },
  CANCELLED: { variant: 'secondary', label: 'Cancelled' },
};

export function CaseStatusBadge({ status }: { status: string }) {
  const entry = MAP[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}

const COMPONENT_MAP: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'; label: string }> = {
  PENDING: { variant: 'outline', label: 'Pending' },
  AWAITING_BATCH: { variant: 'warning', label: 'Awaiting batch' },
  AWAITING_ARN: { variant: 'warning', label: 'Awaiting ARN' },
  ARN_RECEIVED: { variant: 'default', label: 'ARN received' },
  REFUNDED: { variant: 'success', label: 'Refunded' },
  FAILED: { variant: 'destructive', label: 'Failed' },
};

export function ComponentStatusBadge({ status }: { status: string }) {
  const entry = COMPONENT_MAP[status] ?? { variant: 'outline' as const, label: status };
  return <Badge variant={entry.variant}>{entry.label}</Badge>;
}
