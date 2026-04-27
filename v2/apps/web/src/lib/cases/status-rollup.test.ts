import { describe, it, expect } from 'vitest';
import type { ComponentStatus } from '@wow/db';
import { rollupCaseStatus, hasOpenComponents } from './status-rollup';

describe('lib/cases/status-rollup', () => {
  describe('rollupCaseStatus', () => {
    it('returns current when there are no components', () => {
      expect(rollupCaseStatus('APPROVED', [])).toBe('APPROVED');
    });

    it('all REFUNDED -> REFUNDED', () => {
      expect(
        rollupCaseStatus('IN_EXECUTION', ['REFUNDED', 'REFUNDED'] as ComponentStatus[]),
      ).toBe('REFUNDED');
    });

    it('all terminal with some REFUNDED and some FAILED -> PARTIALLY_REFUNDED', () => {
      expect(
        rollupCaseStatus('IN_EXECUTION', ['REFUNDED', 'FAILED'] as ComponentStatus[]),
      ).toBe('PARTIALLY_REFUNDED');
    });

    it('every component FAILED keeps current (manual intervention)', () => {
      expect(
        rollupCaseStatus('IN_EXECUTION', ['FAILED', 'FAILED'] as ComponentStatus[]),
      ).toBe('IN_EXECUTION');
      expect(
        rollupCaseStatus('APPROVED', ['FAILED'] as ComponentStatus[]),
      ).toBe('APPROVED');
    });

    it('mixed: some REFUNDED + some pending -> PARTIALLY_REFUNDED', () => {
      expect(
        rollupCaseStatus(
          'IN_EXECUTION',
          ['REFUNDED', 'PENDING', 'AWAITING_ARN'] as ComponentStatus[],
        ),
      ).toBe('PARTIALLY_REFUNDED');
    });

    it('any moving + APPROVED -> IN_EXECUTION', () => {
      expect(
        rollupCaseStatus('APPROVED', ['AWAITING_ARN', 'PENDING'] as ComponentStatus[]),
      ).toBe('IN_EXECUTION');
      expect(
        rollupCaseStatus('APPROVED', ['ARN_RECEIVED'] as ComponentStatus[]),
      ).toBe('IN_EXECUTION');
    });

    it('all PENDING / AWAITING_BATCH on APPROVED stays APPROVED', () => {
      expect(
        rollupCaseStatus(
          'APPROVED',
          ['PENDING', 'AWAITING_BATCH'] as ComponentStatus[],
        ),
      ).toBe('APPROVED');
    });

    it('does not promote DRAFT or PENDING_APPROVAL into IN_EXECUTION', () => {
      // The rollup is conservative: it only flips APPROVED/IN_EXECUTION,
      // never moves a case out of an upstream gating state.
      expect(
        rollupCaseStatus('DRAFT', ['AWAITING_ARN'] as ComponentStatus[]),
      ).toBe('DRAFT');
      expect(
        rollupCaseStatus('PENDING_APPROVAL', ['ARN_RECEIVED'] as ComponentStatus[]),
      ).toBe('PENDING_APPROVAL');
    });
  });

  describe('hasOpenComponents', () => {
    it('all terminal -> false', () => {
      expect(
        hasOpenComponents(['REFUNDED', 'FAILED'] as ComponentStatus[]),
      ).toBe(false);
    });

    it('any non-terminal -> true', () => {
      expect(
        hasOpenComponents(['REFUNDED', 'PENDING'] as ComponentStatus[]),
      ).toBe(true);
      expect(
        hasOpenComponents(['AWAITING_ARN'] as ComponentStatus[]),
      ).toBe(true);
    });

    it('empty -> false', () => {
      expect(hasOpenComponents([])).toBe(false);
    });
  });
});
