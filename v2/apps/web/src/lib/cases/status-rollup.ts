import type { CaseStatus, ComponentStatus } from '@wow/db';

/**
 * Roll up a case-level status from its components.
 *
 * Rules (operational, not transport-level):
 *   - all components REFUNDED        → REFUNDED
 *   - some REFUNDED, some not        → PARTIALLY_REFUNDED
 *   - any component started moving   → IN_EXECUTION
 *   - otherwise                      → keep current status (caller decides)
 *
 * This helper does NOT advance from DRAFT/PENDING_APPROVAL into execution; it
 * only resolves what an APPROVED/IN_EXECUTION case should look like once
 * components mutate.
 */
export function rollupCaseStatus(
  current: CaseStatus,
  componentStatuses: ComponentStatus[],
): CaseStatus {
  if (componentStatuses.length === 0) return current;

  const refundedCount = componentStatuses.filter((s) => s === 'REFUNDED').length;
  const total = componentStatuses.length;
  const anyMoving = componentStatuses.some(
    (s) => s !== 'PENDING' && s !== 'AWAITING_BATCH',
  );

  if (refundedCount === total) return 'REFUNDED';
  if (refundedCount > 0) return 'PARTIALLY_REFUNDED';
  if (anyMoving && (current === 'APPROVED' || current === 'IN_EXECUTION')) {
    return 'IN_EXECUTION';
  }
  return current;
}

/** Whether the case has any unfinished components. */
export function hasOpenComponents(componentStatuses: ComponentStatus[]): boolean {
  return componentStatuses.some((s) => s !== 'REFUNDED' && s !== 'FAILED');
}
