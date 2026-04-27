import { describe, it, expect } from 'vitest';
import {
  approvalBatchVariant,
  approvalBatchLabel,
  knetBatchVariant,
  knetBatchLabel,
} from './batch-status-display';

describe('lib/batches/batch-status-display', () => {
  describe('approvalBatchVariant', () => {
    it('maps every BatchStatus to a known variant', () => {
      expect(approvalBatchVariant('DRAFT')).toBe('outline');
      expect(approvalBatchVariant('SENT')).toBe('warning');
      expect(approvalBatchVariant('AWAITING_RESPONSE')).toBe('warning');
      expect(approvalBatchVariant('PARTIALLY_DECIDED')).toBe('warning');
      expect(approvalBatchVariant('COMPLETED')).toBe('success');
      expect(approvalBatchVariant('CANCELLED')).toBe('secondary');
    });
  });

  describe('approvalBatchLabel', () => {
    it('renders human-readable text', () => {
      expect(approvalBatchLabel('DRAFT')).toBe('Draft');
      expect(approvalBatchLabel('SENT')).toBe('Sent');
      expect(approvalBatchLabel('AWAITING_RESPONSE')).toBe('Awaiting reply');
      expect(approvalBatchLabel('PARTIALLY_DECIDED')).toBe('Partial');
      expect(approvalBatchLabel('COMPLETED')).toBe('Completed');
      expect(approvalBatchLabel('CANCELLED')).toBe('Cancelled');
    });
  });

  describe('knetBatchVariant', () => {
    it('maps every KnetBatchStatus to a known variant', () => {
      expect(knetBatchVariant('DRAFT')).toBe('outline');
      expect(knetBatchVariant('SENT')).toBe('warning');
      expect(knetBatchVariant('AWAITING_ARNS')).toBe('warning');
      expect(knetBatchVariant('ARNS_RECEIVED')).toBe('default');
      expect(knetBatchVariant('COMPLETED')).toBe('success');
      expect(knetBatchVariant('CANCELLED')).toBe('secondary');
    });
  });

  describe('knetBatchLabel', () => {
    it('renders human-readable text', () => {
      expect(knetBatchLabel('DRAFT')).toBe('Draft');
      expect(knetBatchLabel('SENT')).toBe('Sent');
      expect(knetBatchLabel('AWAITING_ARNS')).toBe('Awaiting ARNs');
      expect(knetBatchLabel('ARNS_RECEIVED')).toBe('ARNs received');
      expect(knetBatchLabel('COMPLETED')).toBe('Completed');
      expect(knetBatchLabel('CANCELLED')).toBe('Cancelled');
    });
  });
});
