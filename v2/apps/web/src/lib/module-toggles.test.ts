import { describe, it, expect, beforeEach, vi } from 'vitest';

const findMany = vi.fn();
const findUnique = vi.fn();

vi.mock('@wow/db', () => ({
  prisma: {
    moduleToggle: {
      findMany: (...args: unknown[]) => findMany(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import {
  MODULE_DEFINITIONS,
  getModuleToggleStatuses,
  isModuleEnabled,
  type ModuleKey,
} from './module-toggles';

beforeEach(() => {
  findMany.mockReset();
  findUnique.mockReset();
});

describe('lib/module-toggles', () => {
  describe('MODULE_DEFINITIONS', () => {
    it('has unique stable keys (sidebar checks against these strings)', () => {
      const keys = MODULE_DEFINITIONS.map((d) => d.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('declares every module enabled-by-default', () => {
      for (const d of MODULE_DEFINITIONS) {
        expect(d.defaultEnabled).toBe(true);
      }
    });

    it('lists every required toggle key', () => {
      const keys = MODULE_DEFINITIONS.map((d) => d.key).sort();
      // Snapshot lock — adding/removing a toggle is intentional and must
      // update this list. Surfaces accidental rename / drop in PR review.
      expect(keys).toEqual(
        [
          'automation-rules',
          'backup',
          'batch-schedules',
          'fraud-signals',
          'promo',
          'reports',
          'scheduled-reports',
          'stores',
        ].sort(),
      );
    });

    it('every entry has a non-empty label and description', () => {
      for (const d of MODULE_DEFINITIONS) {
        expect(d.label.length).toBeGreaterThan(0);
        expect(d.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getModuleToggleStatuses', () => {
    it('returns defaults (isDefault: true) for every module when no rows exist', async () => {
      findMany.mockResolvedValue([]);
      const out = await getModuleToggleStatuses();
      expect(out).toHaveLength(MODULE_DEFINITIONS.length);
      for (const status of out) {
        expect(status.isDefault).toBe(true);
        expect(status.isEnabled).toBe(true);
        expect(status.updatedAt).toBeNull();
      }
    });

    it('preserves the MODULE_DEFINITIONS order (stable for the admin UI)', async () => {
      findMany.mockResolvedValue([]);
      const out = await getModuleToggleStatuses();
      expect(out.map((s) => s.key)).toEqual(MODULE_DEFINITIONS.map((d) => d.key));
    });

    it('overrides with DB rows when present and marks isDefault: false', async () => {
      const updatedAt = new Date('2026-01-01T00:00:00Z');
      findMany.mockResolvedValue([
        {
          key: 'promo',
          label: 'Custom promo label',
          description: 'Custom desc',
          isEnabled: false,
          updatedAt,
        },
      ]);
      const out = await getModuleToggleStatuses();
      const promo = out.find((s) => s.key === 'promo');
      expect(promo).toMatchObject({
        key: 'promo',
        label: 'Custom promo label',
        description: 'Custom desc',
        isEnabled: false,
        isDefault: false,
        updatedAt,
      });
      // Other modules remain defaults.
      const reports = out.find((s) => s.key === 'reports');
      expect(reports?.isDefault).toBe(true);
    });
  });

  describe('isModuleEnabled', () => {
    it('returns false for an unknown module key (defensive default)', async () => {
      // @ts-expect-error - intentionally pass a bogus key
      const out = await isModuleEnabled('does-not-exist');
      expect(out).toBe(false);
      expect(findUnique).not.toHaveBeenCalled();
    });

    it('returns the default when no row exists', async () => {
      findUnique.mockResolvedValue(null);
      const out = await isModuleEnabled('promo' as ModuleKey);
      expect(out).toBe(true);
    });

    it('returns the row value when it exists', async () => {
      findUnique.mockResolvedValue({ key: 'promo', isEnabled: false });
      const out = await isModuleEnabled('promo' as ModuleKey);
      expect(out).toBe(false);
    });
  });
});
