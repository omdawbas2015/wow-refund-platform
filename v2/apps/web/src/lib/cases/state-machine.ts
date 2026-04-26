import type { CaseStatus, ComponentStatus } from '@wow/db';

/**
 * Allowed transitions on the refund case lifecycle.
 *
 * DRAFT → PENDING_APPROVAL (agent submits)
 * PENDING_APPROVAL → APPROVED | REJECTED (manager decides)
 * APPROVED → IN_EXECUTION (first component moves into a batch / starts processing)
 * IN_EXECUTION → PARTIALLY_REFUNDED | REFUNDED (status rollup; see status-rollup.ts)
 * REFUNDED is terminal.
 * Any non-terminal status can be CANCELLED by the agent or admin.
 */
const ALLOWED: Record<CaseStatus, CaseStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['IN_EXECUTION', 'PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED'],
  IN_EXECUTION: ['PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED'],
  PARTIALLY_REFUNDED: ['REFUNDED', 'CANCELLED'],
  REFUNDED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransitionCase(from: CaseStatus, to: CaseStatus): boolean {
  if (from === to) return false;
  return ALLOWED[from]?.includes(to) ?? false;
}

export function assertCaseTransition(from: CaseStatus, to: CaseStatus): void {
  if (!canTransitionCase(from, to)) {
    throw new Error(`INVALID_TRANSITION:${from}->${to}`);
  }
}

/**
 * Component status is mostly driven by external events (batch dispatched, ARN
 * received, agent verified). The state machine here is conservative and only
 * blocks transitions that would represent a clear regression.
 */
const COMPONENT_TERMINAL: ComponentStatus[] = ['REFUNDED', 'FAILED'];

export function isComponentTerminal(status: ComponentStatus): boolean {
  return COMPONENT_TERMINAL.includes(status);
}
