import { prisma } from '@wow/db';

const TTL_MS = 15 * 60 * 1000;

type CachedRate = {
  rate: number;
  fetchedAt: number;
  source: string;
};

const memoryCache = new Map<string, CachedRate>();

function key(from: string, to: string) {
  return `${from.toUpperCase()}__${to.toUpperCase()}`;
}

function isFresh(entry: CachedRate, now: number) {
  return now - entry.fetchedAt < TTL_MS;
}

/**
 * Returns the FX rate from -> to. Always returns 1 when from === to.
 *
 * Lookup order:
 *   1. In-memory cache (15-min TTL).
 *   2. Persisted ExchangeRate row from the DB (also caches it in memory).
 *   3. exchangerate.host live fetch — written back to the DB and cache.
 *
 * Falls back to `null` only when the live fetch fails AND there is no
 * persisted row at all. Stale persisted rows are still returned with a
 * console warning so case math doesn't crash on transient network errors.
 */
export async function getExchangeRate(
  from: string,
  to: string,
): Promise<{ rate: number; source: string; fromCache: boolean } | null> {
  if (from === to) return { rate: 1, source: 'identity', fromCache: true };
  const k = key(from, to);
  const now = Date.now();

  const cached = memoryCache.get(k);
  if (cached && isFresh(cached, now)) {
    return { rate: cached.rate, source: cached.source, fromCache: true };
  }

  const persisted = await prisma.exchangeRate.findUnique({
    where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
  });
  if (persisted && now - persisted.fetchedAt.getTime() < TTL_MS) {
    memoryCache.set(k, {
      rate: persisted.rate,
      fetchedAt: persisted.fetchedAt.getTime(),
      source: persisted.source,
    });
    return { rate: persisted.rate, source: persisted.source, fromCache: true };
  }

  // Fetch fresh from exchangerate.host. Network failures fall back to the
  // stale persisted value if we have one.
  try {
    const url = `https://api.exchangerate.host/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`exchangerate.host responded ${res.status}`);
    const data = (await res.json()) as { result?: number };
    if (typeof data.result !== 'number' || !Number.isFinite(data.result)) {
      throw new Error('exchangerate.host returned non-numeric result');
    }
    const rate = data.result;
    const updatedAt = new Date();
    await prisma.exchangeRate.upsert({
      where: { fromCurrency_toCurrency: { fromCurrency: from, toCurrency: to } },
      create: {
        fromCurrency: from,
        toCurrency: to,
        rate,
        source: 'exchangerate.host',
        fetchedAt: updatedAt,
      },
      update: { rate, source: 'exchangerate.host', fetchedAt: updatedAt },
    });
    memoryCache.set(k, {
      rate,
      fetchedAt: updatedAt.getTime(),
      source: 'exchangerate.host',
    });
    return { rate, source: 'exchangerate.host', fromCache: false };
  } catch (err) {
    if (persisted) {
      console.warn(
        `[exchange-rate] live fetch failed for ${from}->${to}, falling back to stale row from ${persisted.fetchedAt.toISOString()}`,
        err,
      );
      memoryCache.set(k, {
        rate: persisted.rate,
        fetchedAt: persisted.fetchedAt.getTime(),
        source: `${persisted.source}:stale`,
      });
      return {
        rate: persisted.rate,
        source: `${persisted.source}:stale`,
        fromCache: true,
      };
    }
    console.error(`[exchange-rate] no rate available for ${from}->${to}`, err);
    return null;
  }
}

/** Drops every cached entry — primarily for tests. */
export function _resetExchangeRateCache() {
  memoryCache.clear();
}
