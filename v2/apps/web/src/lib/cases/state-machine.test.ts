import { describe, it, expect } from 'vitest';
import {
  canTransitionCase,
  assertCaseTransition,
  isComponentTerminal,
} from './state-machine';

describe('lib/cases/state-machine', () => {
  describe('canTransitionCase', () => {
    it('allows DRAFT -> PENDING_APPROVAL', () => {
      expect(canTransitionCase('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    });

    it('allows PENDING_APPROVAL -> APPROVED / REJECTED / CANCELLED', () => {
      expect(canTransitionCase('PENDING_APPROVAL', 'APPROVED')).toBe(true);
      expect(canTransitionCase('PENDING_APPROVAL', 'REJECTED')).toBe(true);
      expect(canTransitionCase('PENDING_APPROVAL', 'CANCELLED')).toBe(true);
    });

    it('rejects skipping PENDING_APPROVAL (DRAFT -> APPROVED)', () => {
      expect(canTransitionCase('DRAFT', 'APPROVED')).toBe(false);
    });

    it('rejects same-state transition', () => {
      expect(canTransitionCase('DRAFT', 'DRAFT')).toBe(false);
    });

    it('terminal states reject every transition', () => {
      const terminals = ['REFUNDED', 'REJECTED', 'CANCELLED'] as const;
      for (const t of terminals) {
        expect(canTransitionCase(t, 'DRAFT')).toBe(false);
        expect(canTransitionCase(t, 'PENDING_APPROVAL')).toBe(false);
        expect(canTransitionCase(t, 'APPROVED')).toBe(false);
        expect(canTransitionCase(t, 'CANCELLED')).toBe(false);
      }
    });

    it('PARTIALLY_REFUNDED can promote to REFUNDED but not back', () => {
      expect(canTransitionCase('PARTIALLY_REFUNDED', 'REFUNDED')).toBe(true);
      expect(canTransitionCase('PARTIALLY_REFUNDED', 'IN_EXECUTION')).toBe(false);
      expect(canTransitionCase('PARTIALLY_REFUNDED', 'APPROVED')).toBe(false);
    });

    it('IN_EXECUTION can fan out to PARTIALLY_REFUNDED / REFUNDED / CANCELLED', () => {
      expect(canTransitionCase('IN_EXECUTION', 'PARTIALLY_REFUNDED')).toBe(true);
      expect(canTransitionCase('IN_EXECUTION', 'REFUNDED')).toBe(true);
      expect(canTransitionCase('IN_EXECUTION', 'CANCELLED')).toBe(true);
      expect(canTransitionCase('IN_EXECUTION', 'APPROVED')).toBe(false);
    });
  });

  describe('assertCaseTransition', () => {
    it('throws with a stable message on invalid transitions', () => {
      expect(() => assertCaseTransition('REFUNDED', 'DRAFT')).toThrow(
        /INVALID_TRANSITION:REFUNDED->DRAFT/,
      );
    });

    it('does not throw on valid transitions', () => {
      expect(() => assertCaseTransition('DRAFT', 'PENDING_APPROVAL')).not.toThrow();
    });
  });

  describe('isComponentTerminal', () => {
    it('REFUNDED + FAILED are terminal', () => {
      expect(isComponentTerminal('REFUNDED')).toBe(true);
      expect(isComponentTerminal('FAILED')).toBe(true);
    });

    it('PENDING / AWAITING_BATCH / AWAITING_ARN / ARN_RECEIVED are not terminal', () => {
      expect(isComponentTerminal('PENDING')).toBe(false);
      expect(isComponentTerminal('AWAITING_BATCH')).toBe(false);
      expect(isComponentTerminal('AWAITING_ARN')).toBe(false);
      expect(isComponentTerminal('ARN_RECEIVED')).toBe(false);
    });
  });
});
