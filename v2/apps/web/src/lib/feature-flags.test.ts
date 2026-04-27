import { describe, it, expect, beforeEach, vi } from 'vitest';

const findUnique = vi.fn();
const findMany = vi.fn();

vi.mock('@wow/db', () => ({
  prisma: {
    featureFlag: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      findMany: (...args: unknown[]) => findMany(...args),
    },
  },
}));

import { isFeatureEnabled, readFeatureFlags } from './feature-flags';

beforeEach(() => {
  findUnique.mockReset();
  findMany.mockReset();
});

describe('lib/feature-flags', () => {
  describe('isFeatureEnabled', () => {
    it('returns the stored value when the flag exists', async () => {
      findUnique.mockResolvedValue({ key: 'foo', enabled: true });
      expect(await isFeatureEnabled('foo')).toBe(true);
      findUnique.mockResolvedValue({ key: 'foo', enabled: false });
      expect(await isFeatureEnabled('foo')).toBe(false);
    });

    it('returns the fallback when the flag is missing (closed-by-default)', async () => {
      findUnique.mockResolvedValue(null);
      expect(await isFeatureEnabled('missing')).toBe(false);
      expect(await isFeatureEnabled('missing', true)).toBe(true);
    });

    it('returns the fallback when the DB read throws (build-time resilience)', async () => {
      findUnique.mockRejectedValue(new Error('no DB'));
      expect(await isFeatureEnabled('foo')).toBe(false);
      expect(await isFeatureEnabled('foo', true)).toBe(true);
    });
  });

  describe('readFeatureFlags', () => {
    it('returns an empty object for an empty key list (no DB call)', async () => {
      const out = await readFeatureFlags([]);
      expect(out).toEqual({});
      expect(findMany).not.toHaveBeenCalled();
    });

    it('seeds every key with the fallback then overrides with DB rows', async () => {
      findMany.mockResolvedValue([
        { key: 'a', enabled: true },
        { key: 'b', enabled: false },
      ]);
      const out = await readFeatureFlags(['a', 'b', 'c'], false);
      expect(out).toEqual({ a: true, b: false, c: false });
    });

    it('honours the fallback for keys with no row', async () => {
      findMany.mockResolvedValue([{ key: 'a', enabled: false }]);
      const out = await readFeatureFlags(['a', 'b'], true);
      expect(out).toEqual({ a: false, b: true });
    });

    it('swallows DB errors and returns all-fallback', async () => {
      findMany.mockRejectedValue(new Error('no DB'));
      const out = await readFeatureFlags(['a', 'b'], true);
      expect(out).toEqual({ a: true, b: true });
    });
  });
});
