import { describe, it, expect } from 'vitest';
import {
  cn,
  formatCurrency,
  truncate,
  maskEmail,
  generateCaseNumber,
} from './utils';

describe('lib/utils', () => {
  describe('cn', () => {
    it('joins truthy classnames', () => {
      expect(cn('a', 'b')).toBe('a b');
      expect(cn('a', false && 'b', 'c')).toBe('a c');
    });

    it('lets tailwind-merge dedupe conflicting utilities', () => {
      // tailwind-merge collapses px-2 px-4 to px-4 (last wins).
      expect(cn('px-2', 'px-4')).toBe('px-4');
    });
  });

  describe('formatCurrency', () => {
    it('uses Intl with two decimals by default', () => {
      expect(formatCurrency(1500, 'USD', 'en-US')).toMatch(/1,500\.00/);
    });

    it('respects an explicit decimals override', () => {
      expect(formatCurrency(1.2, 'USD', 'en-US', 4)).toMatch(/1\.2000/);
    });

    it('falls back when given an invalid currency code', () => {
      expect(formatCurrency(99, 'XYZ-bad', 'en-US')).toBe('99.00 XYZ-bad');
    });
  });

  describe('truncate', () => {
    it('returns short strings unchanged', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('trims with a single ellipsis when over the limit', () => {
      const out = truncate('the quick brown fox', 10);
      expect(out.length).toBe(10);
      expect(out.endsWith('\u2026')).toBe(true);
    });

    it('handles exact-length strings', () => {
      expect(truncate('exactly', 7)).toBe('exactly');
    });
  });

  describe('maskEmail', () => {
    it('keeps the first two chars and masks the rest', () => {
      expect(maskEmail('alice@example.com')).toBe('al***@example.com');
    });

    it('returns the input unchanged if there is no @', () => {
      expect(maskEmail('not-an-email')).toBe('not-an-email');
    });

    it('handles short locals: 2 chars stays visible (nothing to mask)', () => {
      expect(maskEmail('ab@x.com')).toBe('ab@x.com');
    });

    it('handles 1-char local (degenerate but does not throw)', () => {
      expect(maskEmail('a@x.com')).toBe('a@x.com');
    });
  });

  describe('generateCaseNumber', () => {
    it('zero-pads to 6 digits', () => {
      expect(generateCaseNumber('KW', 2026, 1)).toBe('REF-KW-2026-000001');
      expect(generateCaseNumber('KW', 2026, 42)).toBe('REF-KW-2026-000042');
    });

    it('keeps wide sequences intact', () => {
      expect(generateCaseNumber('SA', 2030, 999_999)).toBe('REF-SA-2030-999999');
    });

    it('passes through above-6-digit sequences without trimming', () => {
      // padStart(6) only pads when shorter; an already-7-digit seq stays
      // at 7 digits.
      expect(generateCaseNumber('AE', 2026, 1_000_000)).toBe('REF-AE-2026-1000000');
    });
  });
});
