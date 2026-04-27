import { describe, it, expect, beforeEach, vi } from 'vitest';

// vi.mock is hoisted to the top of the module, so prisma must be mocked
// before importing the module under test.
const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock('@wow/db', () => ({
  prisma: {
    exchangeRate: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
    },
  },
}));

import { getExchangeRate, _resetExchangeRateCache } from './cache';

const fetchMock = vi.fn();

beforeEach(() => {
  _resetExchangeRateCache();
  findUnique.mockReset();
  upsert.mockReset();
  fetchMock.mockReset();
  // Default: no persisted row, no live response — overridden per test.
  findUnique.mockResolvedValue(null);
  upsert.mockResolvedValue({});
  vi.stubGlobal('fetch', fetchMock);
});

describe('lib/exchange-rate/cache', () => {
  it('returns identity 1.0 when from === to without touching DB or network', async () => {
    const out = await getExchangeRate('USD', 'USD');
    expect(out).toEqual({ rate: 1, source: 'identity', fromCache: true });
    expect(findUnique).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('hits the network on cold cache and writes back to DB + memory', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 0.31 }),
    });
    const out = await getExchangeRate('USD', 'KWD');
    expect(out).toEqual({ rate: 0.31, source: 'exchangerate.host', fromCache: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('serves from in-memory cache on the second call (no second fetch)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 0.31 }),
    });
    await getExchangeRate('USD', 'KWD');
    fetchMock.mockClear();
    upsert.mockClear();
    const second = await getExchangeRate('USD', 'KWD');
    expect(second).toEqual({ rate: 0.31, source: 'exchangerate.host', fromCache: true });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('serves from a fresh persisted DB row without going to the network', async () => {
    findUnique.mockResolvedValue({
      rate: 0.305,
      source: 'manual',
      fetchedAt: new Date(), // now-ish, well within TTL
    });
    const out = await getExchangeRate('USD', 'KWD');
    expect(out).toEqual({ rate: 0.305, source: 'manual', fromCache: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to stale persisted row when the network errors', async () => {
    const stale = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day old
    findUnique.mockResolvedValue({
      rate: 0.30,
      source: 'exchangerate.host',
      fetchedAt: stale,
    });
    fetchMock.mockRejectedValue(new Error('boom'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const out = await getExchangeRate('USD', 'KWD');
    expect(out).toEqual({
      rate: 0.30,
      source: 'exchangerate.host:stale',
      fromCache: true,
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('returns null when there is no persisted row AND the live fetch fails', async () => {
    fetchMock.mockRejectedValue(new Error('boom'));
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await getExchangeRate('USD', 'KWD');
    expect(out).toBeNull();
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });

  it('treats a non-2xx HTTP response as a fetch failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}) });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await getExchangeRate('USD', 'KWD');
    expect(out).toBeNull();
    err.mockRestore();
  });

  it('rejects non-numeric API responses (e.g. result: null)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
    });
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const out = await getExchangeRate('USD', 'KWD');
    expect(out).toBeNull();
    err.mockRestore();
  });

  it('normalises currency case in the cache key (USD/usd hit the same row)', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 0.31 }),
    });
    await getExchangeRate('USD', 'KWD');
    fetchMock.mockClear();
    // Lowercase variants should now hit the in-memory cache (key normalised).
    const second = await getExchangeRate('usd', 'kwd');
    expect(second?.rate).toBe(0.31);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
