import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatMoney, formatDate, formatDateTime, relativeTime } from './format';

describe('lib/format', () => {
  afterEach(() => vi.useRealTimers());

  describe('formatMoney', () => {
    it('formats USD with 2 decimals', () => {
      expect(formatMoney(1234.5, 'USD', 'en-US')).toMatch(/1,234\.50/);
    });

    it('formats KWD with 3 decimals (currency-aware)', () => {
      // Intl emits KWD with three fractional digits by default.
      const out = formatMoney(12.345, 'KWD', 'en-US');
      expect(out).toMatch(/12\.345/);
    });

    it('falls back when currency is invalid', () => {
      expect(formatMoney(10, 'XYZ-not-a-currency', 'en-US')).toMatch(/10\.00/);
    });
  });

  describe('formatDate / formatDateTime', () => {
    it('formats a Date instance', () => {
      const d = new Date('2026-04-27T10:00:00Z');
      const out = formatDate(d, 'en-US');
      expect(out).toContain('2026');
      expect(out).toContain('Apr');
    });

    it('returns em-dash for null/undefined', () => {
      expect(formatDate(null)).toBe('\u2014');
      expect(formatDate(undefined)).toBe('\u2014');
      expect(formatDateTime(null)).toBe('\u2014');
    });

    it('parses ISO string input', () => {
      expect(formatDate('2026-04-27T10:00:00Z', 'en-US')).toContain('2026');
    });

    it('formatDateTime includes hours + minutes', () => {
      const out = formatDateTime('2026-04-27T15:30:00Z', 'en-US');
      // Don't pin to a TZ; just assert digits and a colon between H + M.
      expect(out).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe('relativeTime', () => {
    it('past minute', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
      const out = relativeTime(new Date('2026-04-27T09:59:30Z'), 'en-US');
      expect(out).toMatch(/30 seconds ago|now|just now/i);
    });

    it('promotes correctly: 23h 31m stays in hours, not days', () => {
      // The doc-comment in lib/format calls this out as a regression
      // we already fixed; lock it in.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
      const past = new Date('2026-04-26T10:29:00Z'); // 23h 31m ago
      const out = relativeTime(past, 'en-US');
      expect(out).toMatch(/hour/i);
      expect(out).not.toMatch(/yesterday|day/i);
    });

    it('past day', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
      const out = relativeTime(new Date('2026-04-26T10:00:00Z'), 'en-US');
      expect(out).toMatch(/yesterday|1 day ago|day/i);
    });

    it('future', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-27T10:00:00Z'));
      const out = relativeTime(new Date('2026-04-27T11:00:00Z'), 'en-US');
      expect(out).toMatch(/in/);
    });
  });
});
