import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { consume, _resetMemoryRateLimiter } from './index';

describe('lib/rate-limit (memory backend)', () => {
  beforeEach(() => {
    _resetMemoryRateLimiter();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to N hits in the window', async () => {
    const r1 = await consume('test:user-1', 3, 60_000);
    expect(r1.allowed).toBe(true);
    expect(r1.source).toBe('memory');
    expect(r1.remaining).toBe(2);

    const r2 = await consume('test:user-1', 3, 60_000);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await consume('test:user-1', 3, 60_000);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it('rejects after the cap is hit', async () => {
    for (let i = 0; i < 3; i++) await consume('test:user-2', 3, 60_000);
    const r = await consume('test:user-2', 3, 60_000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.reset).toBeGreaterThan(Date.now());
  });

  it('keys are isolated', async () => {
    for (let i = 0; i < 3; i++) await consume('test:userA', 3, 60_000);
    const blocked = await consume('test:userA', 3, 60_000);
    expect(blocked.allowed).toBe(false);
    const fresh = await consume('test:userB', 3, 60_000);
    expect(fresh.allowed).toBe(true);
  });

  it('window slides: old hits drop out', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-04-27T00:00:00Z');
    vi.setSystemTime(start);
    for (let i = 0; i < 3; i++) await consume('test:slide', 3, 1_000);
    const blocked = await consume('test:slide', 3, 1_000);
    expect(blocked.allowed).toBe(false);

    vi.setSystemTime(new Date(start.getTime() + 2_000));
    const allowedAgain = await consume('test:slide', 3, 1_000);
    expect(allowedAgain.allowed).toBe(true);
  });
});
