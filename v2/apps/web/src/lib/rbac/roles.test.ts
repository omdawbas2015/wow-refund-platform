import { describe, it, expect } from 'vitest';
import {
  isAdmin,
  isManager,
  isOperations,
  isFinance,
  isAuditor,
  canViewAdminArea,
  canViewFinanceArea,
  canViewAuditLog,
  canManageOperations,
  ALL_ROLES,
} from './roles';

describe('lib/rbac/roles', () => {
  it('null / undefined / empty role rejects every check', () => {
    for (const role of [null, undefined, '']) {
      expect(isAdmin(role)).toBe(false);
      expect(isManager(role)).toBe(false);
      expect(isOperations(role)).toBe(false);
      expect(isFinance(role)).toBe(false);
      expect(isAuditor(role)).toBe(false);
      expect(canViewAdminArea(role)).toBe(false);
      expect(canViewFinanceArea(role)).toBe(false);
      expect(canViewAuditLog(role)).toBe(false);
      expect(canManageOperations(role)).toBe(false);
    }
  });

  it('ADMIN passes every gate', () => {
    expect(isAdmin('ADMIN')).toBe(true);
    expect(isManager('ADMIN')).toBe(true);
    expect(isOperations('ADMIN')).toBe(true);
    expect(isFinance('ADMIN')).toBe(true);
    expect(isAuditor('ADMIN')).toBe(true);
    expect(canViewAdminArea('ADMIN')).toBe(true);
    expect(canViewFinanceArea('ADMIN')).toBe(true);
    expect(canViewAuditLog('ADMIN')).toBe(true);
    expect(canManageOperations('ADMIN')).toBe(true);
  });

  it('MANAGER can manage ops + approve, but cannot view admin', () => {
    expect(isManager('MANAGER')).toBe(true);
    expect(isOperations('MANAGER')).toBe(true);
    expect(canManageOperations('MANAGER')).toBe(true);
    expect(isAdmin('MANAGER')).toBe(false);
    expect(canViewAdminArea('MANAGER')).toBe(false);
  });

  it('OPERATIONS can manage operations, not finance / audit', () => {
    expect(canManageOperations('OPERATIONS')).toBe(true);
    expect(isFinance('OPERATIONS')).toBe(false);
    expect(canViewFinanceArea('OPERATIONS')).toBe(false);
    expect(canViewAuditLog('OPERATIONS')).toBe(false);
  });

  it('FINANCE can view finance, not admin / audit', () => {
    expect(isFinance('FINANCE')).toBe(true);
    expect(canViewFinanceArea('FINANCE')).toBe(true);
    expect(canViewAdminArea('FINANCE')).toBe(false);
    expect(canViewAuditLog('FINANCE')).toBe(false);
    expect(canManageOperations('FINANCE')).toBe(false);
  });

  it('AUDITOR is read-only over admin + finance + audit', () => {
    expect(isAuditor('AUDITOR')).toBe(true);
    expect(canViewAdminArea('AUDITOR')).toBe(true);
    expect(canViewFinanceArea('AUDITOR')).toBe(true);
    expect(canViewAuditLog('AUDITOR')).toBe(true);
    // But auditor cannot manage operations or admin-mutate
    expect(canManageOperations('AUDITOR')).toBe(false);
    expect(isAdmin('AUDITOR')).toBe(false);
  });

  it('AGENT / REFUND_AGENT / READ_ONLY are denied admin + audit + ops', () => {
    for (const role of ['AGENT', 'REFUND_AGENT', 'READ_ONLY'] as const) {
      expect(isAdmin(role)).toBe(false);
      expect(isAuditor(role)).toBe(false);
      expect(canViewAdminArea(role)).toBe(false);
      expect(canViewAuditLog(role)).toBe(false);
      expect(canManageOperations(role)).toBe(false);
    }
  });

  it('unknown role string is denied everywhere', () => {
    expect(isAdmin('SUPER_DUPER')).toBe(false);
    expect(canViewAdminArea('SUPER_DUPER')).toBe(false);
  });

  it('ALL_ROLES enumerates exactly the public RoleKey union', () => {
    expect(ALL_ROLES).toEqual([
      'ADMIN',
      'MANAGER',
      'OPERATIONS',
      'FINANCE',
      'AUDITOR',
      'AGENT',
      'REFUND_AGENT',
      'READ_ONLY',
    ]);
  });
});
