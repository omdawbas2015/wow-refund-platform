import { describe, it, expect } from 'vitest';
import {
  caseStatusVariant,
  caseStatusLabel,
  componentStatusVariant,
  componentStatusLabel,
  auraStatusLabel,
} from './case-status-display';

describe('lib/cases/case-status-display', () => {
  describe('caseStatusVariant', () => {
    it('maps every CaseStatus to a known badge variant', () => {
      expect(caseStatusVariant('DRAFT')).toBe('outline');
      expect(caseStatusVariant('PENDING_APPROVAL')).toBe('warning');
      expect(caseStatusVariant('APPROVED')).toBe('default');
      expect(caseStatusVariant('IN_EXECUTION')).toBe('default');
      expect(caseStatusVariant('PARTIALLY_REFUNDED')).toBe('warning');
      expect(caseStatusVariant('REFUNDED')).toBe('success');
      expect(caseStatusVariant('REJECTED')).toBe('destructive');
      expect(caseStatusVariant('CANCELLED')).toBe('secondary');
    });
  });

  describe('caseStatusLabel', () => {
    it('returns short human-readable labels', () => {
      expect(caseStatusLabel('DRAFT')).toBe('Draft');
      expect(caseStatusLabel('PENDING_APPROVAL')).toBe('Pending approval');
      expect(caseStatusLabel('APPROVED')).toBe('Approved');
      expect(caseStatusLabel('IN_EXECUTION')).toBe('In execution');
      expect(caseStatusLabel('PARTIALLY_REFUNDED')).toBe('Partial');
      expect(caseStatusLabel('REFUNDED')).toBe('Refunded');
      expect(caseStatusLabel('REJECTED')).toBe('Rejected');
      expect(caseStatusLabel('CANCELLED')).toBe('Cancelled');
    });
  });

  describe('componentStatusVariant', () => {
    it('maps every ComponentStatus correctly', () => {
      expect(componentStatusVariant('PENDING')).toBe('outline');
      expect(componentStatusVariant('AWAITING_BATCH')).toBe('outline');
      expect(componentStatusVariant('AWAITING_ARN')).toBe('warning');
      expect(componentStatusVariant('ARN_RECEIVED')).toBe('warning');
      expect(componentStatusVariant('REFUNDED')).toBe('success');
      expect(componentStatusVariant('FAILED')).toBe('destructive');
    });
  });

  describe('componentStatusLabel', () => {
    it('returns short human-readable labels', () => {
      expect(componentStatusLabel('PENDING')).toBe('Pending');
      expect(componentStatusLabel('AWAITING_BATCH')).toBe('Awaiting batch');
      expect(componentStatusLabel('AWAITING_ARN')).toBe('Awaiting ARN');
      expect(componentStatusLabel('ARN_RECEIVED')).toBe('ARN received');
      expect(componentStatusLabel('REFUNDED')).toBe('Refunded');
      expect(componentStatusLabel('FAILED')).toBe('Failed');
    });
  });

  describe('auraStatusLabel', () => {
    it('NONE renders as em-dash', () => {
      expect(auraStatusLabel('NONE')).toBe('\u2014');
    });

    it('other statuses render their label', () => {
      expect(auraStatusLabel('PENDING')).toBe('Pending');
      expect(auraStatusLabel('IN_BATCH')).toBe('In batch');
      expect(auraStatusLabel('COMPLETED')).toBe('Completed');
      expect(auraStatusLabel('FAILED')).toBe('Failed');
    });
  });
});
