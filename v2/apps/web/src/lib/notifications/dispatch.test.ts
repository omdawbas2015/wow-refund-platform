import { describe, it, expect, beforeEach, vi } from 'vitest';

const findMany = vi.fn();
const createMany = vi.fn();

vi.mock('@wow/db', () => ({
  prisma: {
    user: { findMany: (...args: unknown[]) => findMany(...args) },
    notification: { createMany: (...args: unknown[]) => createMany(...args) },
  },
}));

const publish = vi.fn();
vi.mock('@/lib/events/bus', () => ({
  publish: (...args: unknown[]) => publish(...args),
}));

import {
  dispatchNotifications,
  parseMutedKinds,
  serializeMutedKinds,
  MUTABLE_NOTIFICATION_KINDS,
} from './dispatch';

beforeEach(() => {
  findMany.mockReset();
  createMany.mockReset();
  publish.mockReset();
  createMany.mockResolvedValue({ count: 0 });
});

describe('lib/notifications/dispatch', () => {
  describe('parseMutedKinds', () => {
    it('returns an empty set on null / empty input', () => {
      expect(parseMutedKinds(null).size).toBe(0);
      expect(parseMutedKinds(undefined).size).toBe(0);
      expect(parseMutedKinds('').size).toBe(0);
    });

    it('splits a comma-separated list and trims each entry', () => {
      const out = parseMutedKinds('SLA_WARNING, FRAUD_SIGNAL ,CUSTOMER_REPLY');
      expect(out.has('SLA_WARNING')).toBe(true);
      expect(out.has('FRAUD_SIGNAL')).toBe(true);
      expect(out.has('CUSTOMER_REPLY')).toBe(true);
      expect(out.size).toBe(3);
    });

    it('drops empty fragments from trailing commas', () => {
      const out = parseMutedKinds('SLA_WARNING,,');
      expect(out.size).toBe(1);
      expect(out.has('SLA_WARNING')).toBe(true);
    });
  });

  describe('serializeMutedKinds', () => {
    it('joins with commas in declared order', () => {
      expect(serializeMutedKinds(['SLA_WARNING', 'FRAUD_SIGNAL'])).toBe(
        'SLA_WARNING,FRAUD_SIGNAL',
      );
    });

    it('dedupes input', () => {
      expect(serializeMutedKinds(['SLA_WARNING', 'SLA_WARNING'])).toBe('SLA_WARNING');
    });

    it('returns empty string for empty input', () => {
      expect(serializeMutedKinds([])).toBe('');
    });

    it('roundtrips through parseMutedKinds', () => {
      const raw = serializeMutedKinds(['ARN_RECEIVED', 'AURA_CONFIRMED']);
      const parsed = parseMutedKinds(raw);
      expect(parsed.has('ARN_RECEIVED')).toBe(true);
      expect(parsed.has('AURA_CONFIRMED')).toBe(true);
      expect(parsed.size).toBe(2);
    });
  });

  describe('MUTABLE_NOTIFICATION_KINDS', () => {
    it('declares no duplicate kinds', () => {
      const kinds = MUTABLE_NOTIFICATION_KINDS.map((k) => k.kind);
      expect(new Set(kinds).size).toBe(kinds.length);
    });

    it('every entry has a label + description', () => {
      for (const m of MUTABLE_NOTIFICATION_KINDS) {
        expect(m.label.length).toBeGreaterThan(0);
        expect(m.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('dispatchNotifications', () => {
    it('returns zeros and skips DB on an empty user list', async () => {
      const out = await dispatchNotifications({
        userIds: [],
        type: 'SLA_WARNING',
        title: 'x',
      });
      expect(out).toEqual({ created: 0, mutedSkipped: 0, unknownSkipped: 0 });
      expect(findMany).not.toHaveBeenCalled();
      expect(createMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('dedupes the user list before any DB read', async () => {
      findMany.mockResolvedValue([
        { id: 'u1', mutedNotificationKinds: null },
      ]);
      await dispatchNotifications({
        userIds: ['u1', 'u1', 'u1'],
        type: 'SLA_WARNING',
        title: 'x',
      });
      const where = findMany.mock.calls[0][0]?.where?.id?.in;
      expect(where).toEqual(['u1']);
    });

    it('counts users who no longer exist as unknownSkipped', async () => {
      findMany.mockResolvedValue([
        { id: 'u1', mutedNotificationKinds: null },
      ]);
      const out = await dispatchNotifications({
        userIds: ['u1', 'u2', 'u3'],
        type: 'SLA_WARNING',
        title: 'x',
      });
      expect(out.unknownSkipped).toBe(2);
      expect(out.created).toBe(1);
    });

    it('skips muted users without writing or publishing for them', async () => {
      findMany.mockResolvedValue([
        { id: 'u1', mutedNotificationKinds: 'SLA_WARNING' },
        { id: 'u2', mutedNotificationKinds: null },
      ]);
      const out = await dispatchNotifications({
        userIds: ['u1', 'u2'],
        type: 'SLA_WARNING',
        title: 'x',
      });
      expect(out).toEqual({ created: 1, mutedSkipped: 1, unknownSkipped: 0 });

      const writtenRows = createMany.mock.calls[0][0]?.data;
      expect(writtenRows).toHaveLength(1);
      expect(writtenRows[0].userId).toBe('u2');

      expect(publish).toHaveBeenCalledTimes(1);
      expect(publish).toHaveBeenCalledWith('u2', expect.objectContaining({ type: 'notification' }));
    });

    it('does not write or publish at all when every targeted user is muted', async () => {
      findMany.mockResolvedValue([
        { id: 'u1', mutedNotificationKinds: 'SLA_WARNING' },
      ]);
      const out = await dispatchNotifications({
        userIds: ['u1'],
        type: 'SLA_WARNING',
        title: 'x',
      });
      expect(out).toEqual({ created: 0, mutedSkipped: 1, unknownSkipped: 0 });
      expect(createMany).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
    });

    it('publishes a minimal payload (kind + title + context) per allowed user', async () => {
      findMany.mockResolvedValue([
        { id: 'u1', mutedNotificationKinds: null },
      ]);
      await dispatchNotifications({
        userIds: ['u1'],
        type: 'CASE_APPROVED',
        title: 'Case approved',
        contextType: 'RefundCase',
        contextId: 'case-123',
      });
      expect(publish).toHaveBeenCalledWith('u1', {
        type: 'notification',
        data: {
          kind: 'CASE_APPROVED',
          title: 'Case approved',
          contextType: 'RefundCase',
          contextId: 'case-123',
        },
      });
    });

    it('honours optional fields by writing null when not provided', async () => {
      findMany.mockResolvedValue([
        { id: 'u1', mutedNotificationKinds: null },
      ]);
      await dispatchNotifications({
        userIds: ['u1'],
        type: 'SYSTEM',
        title: 'system msg',
      });
      const row = createMany.mock.calls[0][0]?.data?.[0];
      expect(row).toMatchObject({
        userId: 'u1',
        type: 'SYSTEM',
        title: 'system msg',
        body: null,
        href: null,
        contextType: null,
        contextId: null,
      });
    });
  });
});
