import { describe, it, expect } from 'vitest';
import type { SlaRule } from '@wow/db';
import {
  pickSlaRule,
  classifyByHours,
  hoursBetween,
  DEFAULT_THRESHOLD_HOURS,
  DEFAULT_WARNING_HOURS,
} from './sla-rules';

const rule = (overrides: Partial<SlaRule>): SlaRule => ({
  id: overrides.id ?? 'rule-id',
  name: overrides.name ?? 'rule',
  isActive: overrides.isActive ?? true,
  countryId: overrides.countryId ?? null,
  brandId: overrides.brandId ?? null,
  rootCauseId: overrides.rootCauseId ?? null,
  thresholdHours: overrides.thresholdHours ?? 72,
  warningHours: overrides.warningHours ?? 36,
  createdAt: overrides.createdAt ?? new Date('2026-01-01'),
  updatedAt: overrides.updatedAt ?? new Date('2026-01-01'),
});

describe('lib/cases/sla-rules', () => {
  describe('pickSlaRule', () => {
    it('returns defaults when no rule matches', () => {
      const out = pickSlaRule([], {
        countryId: 'KW',
        brandId: 'B',
        rootCauseId: null,
      });
      expect(out.rule).toBeNull();
      expect(out.thresholdHours).toBe(DEFAULT_THRESHOLD_HOURS);
      expect(out.warningHours).toBe(DEFAULT_WARNING_HOURS);
    });

    it('skips inactive rules entirely', () => {
      const out = pickSlaRule(
        [rule({ id: 'r1', isActive: false, countryId: 'KW', thresholdHours: 24 })],
        { countryId: 'KW', brandId: null, rootCauseId: null },
      );
      expect(out.rule).toBeNull();
    });

    it('rejects rules whose scope does not match the case', () => {
      const out = pickSlaRule(
        [rule({ id: 'r1', countryId: 'KW' })],
        { countryId: 'SA', brandId: null, rootCauseId: null },
      );
      expect(out.rule).toBeNull();
    });

    it('global rule (all-null scope) matches every case', () => {
      const r = rule({ id: 'r1', name: 'global', thresholdHours: 48, warningHours: 24 });
      const out = pickSlaRule(
        [r],
        { countryId: 'KW', brandId: 'B', rootCauseId: 'rc' },
      );
      expect(out.rule?.id).toBe('r1');
      expect(out.thresholdHours).toBe(48);
      expect(out.warningHours).toBe(24);
    });

    it('country+brand+rootCause beats country-only beats global (most-specific wins)', () => {
      const global = rule({ id: 'global', name: 'a-global' });
      const country = rule({ id: 'country', name: 'b-country', countryId: 'KW' });
      const all = rule({
        id: 'all',
        name: 'c-all',
        countryId: 'KW',
        brandId: 'B',
        rootCauseId: 'rc',
      });
      const out = pickSlaRule([global, country, all], {
        countryId: 'KW',
        brandId: 'B',
        rootCauseId: 'rc',
      });
      expect(out.rule?.id).toBe('all');
    });

    it('breaks ties by rule.name (alphabetic, stable)', () => {
      const r1 = rule({ id: 'r1', name: 'beta', countryId: 'KW' });
      const r2 = rule({ id: 'r2', name: 'alpha', countryId: 'KW' });
      const out = pickSlaRule([r1, r2], {
        countryId: 'KW',
        brandId: null,
        rootCauseId: null,
      });
      expect(out.rule?.id).toBe('r2'); // alpha < beta
    });
  });

  describe('classifyByHours', () => {
    const resolved = {
      rule: null,
      thresholdHours: 72,
      warningHours: 36,
    };

    it('< warning -> on_track', () => {
      expect(classifyByHours(0, resolved)).toBe('on_track');
      expect(classifyByHours(35.99, resolved)).toBe('on_track');
    });

    it('warning <= h < threshold -> warning', () => {
      expect(classifyByHours(36, resolved)).toBe('warning');
      expect(classifyByHours(71.99, resolved)).toBe('warning');
    });

    it('>= threshold -> breached', () => {
      expect(classifyByHours(72, resolved)).toBe('breached');
      expect(classifyByHours(168, resolved)).toBe('breached');
    });

    it('null warningHours -> warning tier never fires', () => {
      const r = { rule: null, thresholdHours: 72, warningHours: null };
      expect(classifyByHours(40, r)).toBe('on_track');
      expect(classifyByHours(72, r)).toBe('breached');
    });
  });

  describe('hoursBetween', () => {
    it('returns the difference in hours', () => {
      const from = new Date('2026-04-27T00:00:00Z');
      const to = new Date('2026-04-27T03:30:00Z');
      expect(hoursBetween(from, to)).toBe(3.5);
    });

    it('clamps negative diffs (future from) to 0', () => {
      const from = new Date('2026-05-01T00:00:00Z');
      const to = new Date('2026-04-27T00:00:00Z');
      expect(hoursBetween(from, to)).toBe(0);
    });
  });
});
