import { describe, it, expect, vi, afterEach } from 'vitest';
import { parseRange, eachDayInRange } from './range';

describe('lib/reports/range', () => {
  afterEach(() => vi.useRealTimers());

  describe('parseRange', () => {
    it('defaults to the last 30 days when both inputs missing', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
      const r = parseRange();
      expect(r.toIso).toBe('2026-04-27');
      expect(r.fromIso).toBe('2026-03-29'); // 29 days back -> 30-day window
      expect(r.from.getUTCHours()).toBe(0);
      expect(r.to.getUTCHours()).toBe(23);
    });

    it('accepts an explicit from + to', () => {
      const r = parseRange({ from: '2026-01-01', to: '2026-01-31' });
      expect(r.fromIso).toBe('2026-01-01');
      expect(r.toIso).toBe('2026-01-31');
      expect(r.from.toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(r.to.toISOString()).toBe('2026-01-31T23:59:59.999Z');
    });

    it('falls back to default when input is malformed', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-04-27T12:00:00Z'));
      const r = parseRange({ from: 'not-a-date', to: '2026/04/01' });
      expect(r.toIso).toBe('2026-04-27');
      expect(r.fromIso).toBe('2026-03-29');
    });
  });

  describe('eachDayInRange', () => {
    it('enumerates inclusive days', () => {
      const r = parseRange({ from: '2026-04-01', to: '2026-04-03' });
      expect(eachDayInRange(r)).toEqual(['2026-04-01', '2026-04-02', '2026-04-03']);
    });

    it('handles same-day ranges', () => {
      const r = parseRange({ from: '2026-04-01', to: '2026-04-01' });
      expect(eachDayInRange(r)).toEqual(['2026-04-01']);
    });

    it('crosses month boundaries cleanly', () => {
      const r = parseRange({ from: '2026-04-29', to: '2026-05-02' });
      expect(eachDayInRange(r)).toEqual([
        '2026-04-29',
        '2026-04-30',
        '2026-05-01',
        '2026-05-02',
      ]);
    });
  });
});
