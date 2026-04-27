import { describe, it, expect } from 'vitest';
import { parseCron, cronMatches, isDueSince, validateCron } from './cron';

const at = (iso: string) => new Date(iso);

describe('lib/scheduled-reports/cron', () => {
  describe('parseCron', () => {
    it('parses every-minute as full sets', () => {
      const s = parseCron('* * * * *');
      expect(s.minute.size).toBe(60);
      expect(s.hour.size).toBe(24);
      expect(s.dom.size).toBe(31);
      expect(s.month.size).toBe(12);
      expect(s.dow.size).toBe(7);
    });

    it('parses ranges', () => {
      const s = parseCron('0 9-17 * * 1-5');
      expect([...s.hour].sort((a, b) => a - b)).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17]);
      expect([...s.dow].sort()).toEqual([1, 2, 3, 4, 5]);
    });

    it('parses lists', () => {
      const s = parseCron('0,30 * * * *');
      expect([...s.minute].sort((a, b) => a - b)).toEqual([0, 30]);
    });

    it('parses steps', () => {
      const s = parseCron('*/15 * * * *');
      expect([...s.minute].sort((a, b) => a - b)).toEqual([0, 15, 30, 45]);
    });

    it('parses bare numbers', () => {
      const s = parseCron('5 8 1 1 0');
      expect([...s.minute]).toEqual([5]);
      expect([...s.hour]).toEqual([8]);
      expect([...s.month]).toEqual([1]);
      expect([...s.dow]).toEqual([0]);
    });

    it('rejects wrong number of fields', () => {
      expect(() => parseCron('* * * *')).toThrow(/5 fields/);
      expect(() => parseCron('* * * * * *')).toThrow(/5 fields/);
    });

    it('rejects out-of-range values', () => {
      expect(() => parseCron('60 * * * *')).toThrow(/out of range/);
      expect(() => parseCron('* 24 * * *')).toThrow(/out of range/);
      expect(() => parseCron('* * 0 * *')).toThrow(/out of range/);
    });

    it('rejects garbage', () => {
      expect(() => parseCron('xyz * * * *')).toThrow();
    });
  });

  describe('cronMatches', () => {
    it('matches every minute', () => {
      const s = parseCron('* * * * *');
      expect(cronMatches(s, at('2026-04-27T03:14:00Z'))).toBe(true);
    });

    it('matches at top of hour', () => {
      const s = parseCron('0 * * * *');
      expect(cronMatches(s, at('2026-04-27T03:00:00Z'))).toBe(true);
      expect(cronMatches(s, at('2026-04-27T03:01:00Z'))).toBe(false);
    });

    it('weekday morning rule (0 9 * * 1-5)', () => {
      const s = parseCron('0 9 * * 1-5');
      // Monday 2026-04-27 09:00 UTC
      expect(cronMatches(s, at('2026-04-27T09:00:00Z'))).toBe(true);
      // Saturday 2026-04-25 09:00 UTC
      expect(cronMatches(s, at('2026-04-25T09:00:00Z'))).toBe(false);
    });

    it('OR semantics when both dom + dow restricted', () => {
      // The 1st of any month OR Sunday
      const s = parseCron('0 0 1 * 0');
      expect(cronMatches(s, at('2026-05-01T00:00:00Z'))).toBe(true); // 1st of month
      expect(cronMatches(s, at('2026-04-26T00:00:00Z'))).toBe(true); // Sunday
      expect(cronMatches(s, at('2026-04-27T00:00:00Z'))).toBe(false); // Monday, not 1st
    });
  });

  describe('isDueSince', () => {
    it('returns true if a matching minute fell in the window', () => {
      const s = parseCron('0 9 * * 1-5');
      const since = at('2026-04-27T08:00:00Z');
      const now = at('2026-04-27T10:00:00Z');
      expect(isDueSince(s, since, now)).toBe(true);
    });

    it('returns false if no match in the window', () => {
      const s = parseCron('0 9 * * 1-5');
      const since = at('2026-04-27T10:00:00Z');
      const now = at('2026-04-27T10:30:00Z');
      expect(isDueSince(s, since, now)).toBe(false);
    });

    it('caps look-back at 14 days when since is null', () => {
      const s = parseCron('0 0 1 1 *'); // Jan 1 only
      const now = at('2026-01-15T00:00:00Z');
      // Within 14 days of now Jan 1 falls in [now - 14d, now] → due.
      expect(isDueSince(s, null, now)).toBe(true);
      const farFromJan1 = at('2026-04-27T00:00:00Z');
      // From here, Jan 1 is way out of the 14-day cap → not due.
      expect(isDueSince(s, null, farFromJan1)).toBe(false);
    });
  });

  describe('validateCron', () => {
    it('returns null for valid expressions', () => {
      expect(validateCron('* * * * *')).toBeNull();
      expect(validateCron('0 9 * * 1-5')).toBeNull();
      expect(validateCron('*/5 * * * *')).toBeNull();
    });

    it('returns the error message for invalid expressions', () => {
      const err = validateCron('60 * * * *');
      expect(err).toMatch(/out of range/);
    });
  });
});
