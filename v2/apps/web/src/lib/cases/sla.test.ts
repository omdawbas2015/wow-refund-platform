import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isTerminalStatus,
  daysSince,
  classifySla,
  slaDotClasses,
  slaTierLabel,
  formatSlaCell,
  buildSlaConditions,
  parseSlaParam,
} from './sla';

const date = (iso: string) => new Date(iso);

describe('lib/cases/sla', () => {
  afterEach(() => vi.useRealTimers());

  describe('isTerminalStatus', () => {
    it('REFUNDED / REJECTED / CANCELLED are terminal', () => {
      expect(isTerminalStatus('REFUNDED')).toBe(true);
      expect(isTerminalStatus('REJECTED')).toBe(true);
      expect(isTerminalStatus('CANCELLED')).toBe(true);
    });

    it('open statuses are not terminal', () => {
      expect(isTerminalStatus('DRAFT')).toBe(false);
      expect(isTerminalStatus('PENDING_APPROVAL')).toBe(false);
      expect(isTerminalStatus('APPROVED')).toBe(false);
      expect(isTerminalStatus('IN_EXECUTION')).toBe(false);
      expect(isTerminalStatus('PARTIALLY_REFUNDED')).toBe(false);
    });
  });

  describe('daysSince', () => {
    it('floors to whole days', () => {
      const now = date('2026-04-27T00:00:00Z');
      expect(daysSince(date('2026-04-27T00:00:00Z'), now)).toBe(0);
      expect(daysSince(date('2026-04-26T01:00:00Z'), now)).toBe(0); // 23h ago
      expect(daysSince(date('2026-04-26T00:00:00Z'), now)).toBe(1);
      expect(daysSince(date('2026-04-20T00:00:00Z'), now)).toBe(7);
    });

    it('clamps negative diffs to 0', () => {
      const now = date('2026-04-27T00:00:00Z');
      expect(daysSince(date('2026-05-01T00:00:00Z'), now)).toBe(0);
    });
  });

  describe('classifySla', () => {
    const now = date('2026-04-27T00:00:00Z');

    it('terminal statuses are classified as closed', () => {
      const r = classifySla('REFUNDED', date('2026-04-20T00:00:00Z'), now);
      expect(r.tier).toBe('closed');
      expect(r.days).toBe(7);
    });

    it('0-2 days -> on_track', () => {
      expect(classifySla('APPROVED', date('2026-04-26T00:00:00Z'), now).tier).toBe('on_track');
      expect(classifySla('APPROVED', date('2026-04-25T00:00:00Z'), now).tier).toBe('on_track');
    });

    it('3-5 days -> warning', () => {
      expect(classifySla('APPROVED', date('2026-04-24T00:00:00Z'), now).tier).toBe('warning');
      expect(classifySla('APPROVED', date('2026-04-22T00:00:00Z'), now).tier).toBe('warning');
    });

    it('6+ days -> breached', () => {
      expect(classifySla('APPROVED', date('2026-04-21T00:00:00Z'), now).tier).toBe('breached');
      expect(classifySla('APPROVED', date('2026-04-15T00:00:00Z'), now).tier).toBe('breached');
    });
  });

  describe('display helpers', () => {
    it('slaDotClasses covers every tier', () => {
      expect(slaDotClasses('breached')).toMatch(/destructive/);
      expect(slaDotClasses('warning')).toMatch(/amber/);
      expect(slaDotClasses('on_track')).toMatch(/emerald/);
      expect(slaDotClasses('closed')).toMatch(/muted/);
    });

    it('slaTierLabel covers every tier', () => {
      expect(slaTierLabel('breached')).toBe('SLA breached');
      expect(slaTierLabel('warning')).toBe('SLA at risk');
      expect(slaTierLabel('on_track')).toBe('On track');
      expect(slaTierLabel('closed')).toBe('Closed');
    });

    it('formatSlaCell decorates per tier', () => {
      expect(formatSlaCell('breached', 7)).toMatch(/7d.*\u203C/);
      expect(formatSlaCell('warning', 4)).toMatch(/4d.*\u26A0/);
      expect(formatSlaCell('on_track', 1)).toBe('1d');
      expect(formatSlaCell('closed', 9)).toBe('9d');
    });
  });

  describe('buildSlaConditions', () => {
    const now = date('2026-04-27T00:00:00Z');

    it("'all' returns no conditions", () => {
      expect(buildSlaConditions('all', now)).toEqual([]);
    });

    it("'closed' returns the terminal-in filter", () => {
      const c = buildSlaConditions('closed', now);
      expect(c).toEqual([
        { status: { in: ['REFUNDED', 'REJECTED', 'CANCELLED'] } },
      ]);
    });

    it("'breached' includes notTerminal + createdAt <= now-6d", () => {
      const c = buildSlaConditions('breached', now);
      expect(c[0]).toEqual({
        status: { notIn: ['REFUNDED', 'REJECTED', 'CANCELLED'] },
      });
      const createdAt = (c[1] as { createdAt: { lte: Date } }).createdAt;
      const expected = new Date(now.getTime() - 6 * 86_400_000);
      expect(createdAt.lte.getTime()).toBe(expected.getTime());
    });

    it("'warning' uses (now-6d, now-3d]", () => {
      const c = buildSlaConditions('warning', now);
      const range = (c[1] as { createdAt: { lte: Date; gt: Date } }).createdAt;
      expect(range.lte.getTime()).toBe(now.getTime() - 3 * 86_400_000);
      expect(range.gt.getTime()).toBe(now.getTime() - 6 * 86_400_000);
    });

    it("'on_track' is createdAt > now-3d", () => {
      const c = buildSlaConditions('on_track', now);
      const range = (c[1] as { createdAt: { gt: Date } }).createdAt;
      expect(range.gt.getTime()).toBe(now.getTime() - 3 * 86_400_000);
    });
  });

  describe('parseSlaParam', () => {
    it('accepts known tiers (case-insensitive)', () => {
      expect(parseSlaParam('breached')).toBe('breached');
      expect(parseSlaParam('WARNING')).toBe('warning');
      expect(parseSlaParam('On_Track')).toBe('on_track');
      expect(parseSlaParam('closed')).toBe('closed');
    });

    it("falls back to 'all' for unknown / missing", () => {
      expect(parseSlaParam(undefined)).toBe('all');
      expect(parseSlaParam('')).toBe('all');
      expect(parseSlaParam('garbage')).toBe('all');
    });
  });
});
