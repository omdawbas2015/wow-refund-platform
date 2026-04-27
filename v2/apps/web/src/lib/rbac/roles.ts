/**
 * Role-based access helpers.
 *
 * Roles are stored in the DB as Role rows keyed by stable strings
 * (`Role.key`). The Auth.js session normalises this to `session.user.role`.
 * Centralising the comparison here means future code never reaches for
 * `=== 'ADMIN'` directly — instead it asks intent (canManageUsers,
 * canViewBatches, …) and we update the rules in one place.
 *
 * Role hierarchy (rough)
 *   ADMIN         — full access, owns all admin pages.
 *   MANAGER       — operations leadership; can approve cases.
 *   OPERATIONS    — runs the day-to-day operations queue.
 *   FINANCE       — KNET batches, ARN confirmation, financial reports.
 *   AUDITOR       — read-only over everything (including audit log).
 *   AGENT         — creates and edits cases; allocates promos.
 *   REFUND_AGENT  — executes refunds (subset of AGENT + batch view).
 *   READ_ONLY     — minimal read access.
 */

export type RoleKey =
  | 'ADMIN'
  | 'MANAGER'
  | 'OPERATIONS'
  | 'FINANCE'
  | 'AUDITOR'
  | 'AGENT'
  | 'REFUND_AGENT'
  | 'READ_ONLY';

export const ALL_ROLES: RoleKey[] = [
  'ADMIN',
  'MANAGER',
  'OPERATIONS',
  'FINANCE',
  'AUDITOR',
  'AGENT',
  'REFUND_AGENT',
  'READ_ONLY',
];

export type SessionRole = string | null | undefined;

function roleIs(role: SessionRole, ...needles: RoleKey[]): boolean {
  if (!role) return false;
  return (needles as string[]).includes(role);
}

export function isAdmin(role: SessionRole) {
  return roleIs(role, 'ADMIN');
}
export function isManager(role: SessionRole) {
  return roleIs(role, 'ADMIN', 'MANAGER');
}
export function isOperations(role: SessionRole) {
  return roleIs(role, 'ADMIN', 'MANAGER', 'OPERATIONS');
}
export function isFinance(role: SessionRole) {
  return roleIs(role, 'ADMIN', 'FINANCE');
}
export function isAuditor(role: SessionRole) {
  return roleIs(role, 'ADMIN', 'AUDITOR');
}

/** Anyone allowed to *see* admin-side surfaces (admin OR auditor). Admins
 *  can mutate; auditors can only read. Mutating actions must call
 *  isAdmin() explicitly. */
export function canViewAdminArea(role: SessionRole) {
  return isAdmin(role) || isAuditor(role);
}

/** KNET batches, ARN confirmation, financial reports. */
export function canViewFinanceArea(role: SessionRole) {
  return isFinance(role) || isAuditor(role);
}

/** Audit log + read-only audit views. */
export function canViewAuditLog(role: SessionRole) {
  return isAuditor(role) || isAdmin(role);
}

/** Active operational queue: assignment, bulk operations, etc. */
export function canManageOperations(role: SessionRole) {
  return isOperations(role);
}
