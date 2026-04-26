import type { CaseStatus, ComponentStatus } from '@wow/db';

/**
 * Roll up a case-level status from its components.
 *
 * Rules (operational, not transport-level):
 *   - all components REFUNDED                 → REFUNDED
 *   - all components terminal (REFUNDED|FAILED), at least one FAILED
 *     - any REFUNDED                          → PARTIALLY_REFUNDED
 *     - none REFUNDED (every one FAILED)      → keep current
 *       (manual intervention / retry / cancel)
 *   - some REFUNDED, some not yet terminal    → PARTIALLY_REFUNDED
 *   - any component started moving            → IN_EXECUTION
 *   - otherwise                               → keep current status
 *
 * This helper does NOT advance from DRAFT/PENDING_APPROVAL into execution; it
 * only resolves what an APPROVED/IN_EXECUTION case should look like once
 * components mutate. The all-FAILED case is intentionally returned as
 * `current` (rather than auto-cancelling) so it stays visible in the
 * "open / IN_EXECUTION" queue and a human can decide whether to retry or
 * cancel it — auto-cancelling on the first batch of rejections would lose
 * that context.
 */
export function rollupCaseStatus(
  current: CaseStatus,
  componentStatuses: ComponentStatus[],
): CaseStatus {
  if (componentStatuses.length === 0) return current;

  const refundedCount = componentStatuses.filter((s) => s === 'REFUNDED').length;
  const failedCount = componentStatuses.filter((s) => s === 'FAILED').length;
  const total = componentStatuses.length;
  const allTerminal = refundedCount + failedCount === total;
  const anyMoving = componentStatuses.some(
    (s) => s !== 'PENDING' && s !== 'AWAITING_BATCH',
  );

  if (refundedCount === total) return 'REFUNDED';
  // Once everything is decided and at least one component refunded, the case
  // is partial — even if some siblings failed.
  if (allTerminal && refundedCount > 0) return 'PARTIALLY_REFUNDED';
  // Every component failed: keep current so a human can intervene rather
  // than letting the case slip into IN_EXECUTION purgatory.
  if (allTerminal) return current;
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
