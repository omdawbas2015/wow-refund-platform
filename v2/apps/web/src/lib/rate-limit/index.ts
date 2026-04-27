/**
 * Lightweight rate limiter with two backends:
 *
 *   1. In-memory sliding-window (default; works in single-process dev/SSR
 *      and on a single Node instance in prod).
 *   2. @upstash/ratelimit when UPSTASH_REDIS_REST_URL and
 *      UPSTASH_REDIS_REST_TOKEN env vars are set.
 *
 * Designed primarily for /api/auth/* — login, signup, forgot/reset-password.
 * The public surface is `consume(key, max, windowMs)`; the result tells the
 * caller how many requests remain and when the window resets.
 */

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

type Hit = { ts: number };
const buckets = new Map<string, Hit[]>();

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  reset: number; // epoch ms when the oldest hit will expire
  source: 'memory' | 'upstash';
};

function gc(now: number) {
  // Cheap periodic prune so the map doesn't grow unbounded under abuse.
  if (buckets.size < 4096) return;
  for (const [k, hits] of buckets) {
    const filtered = hits.filter((h) => now - h.ts < 24 * 3600 * 1000);
    if (filtered.length === 0) buckets.delete(k);
    else buckets.set(k, filtered);
  }
}

function memoryConsume(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  gc(now);
  const hits = (buckets.get(key) ?? []).filter((h) => now - h.ts < windowMs);
  if (hits.length >= max) {
    const reset = (hits[0]?.ts ?? now) + windowMs;
    buckets.set(key, hits);
    return { allowed: false, remaining: 0, reset, source: 'memory' };
  }
  hits.push({ ts: now });
  buckets.set(key, hits);
  return {
    allowed: true,
    remaining: Math.max(0, max - hits.length),
    reset: now + windowMs,
    source: 'memory',
  };
}

const upstashLimiters = new Map<string, Ratelimit>();

function getUpstashLimiter(max: number, windowMs: number): Ratelimit | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  const cacheKey = `${max}:${windowMs}`;
  const cached = upstashLimiters.get(cacheKey);
  if (cached) return cached;
  const limiter = new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(max, `${Math.ceil(windowMs / 1000)} s`),
    analytics: false,
    prefix: 'wow-refund:rl',
  });
  upstashLimiters.set(cacheKey, limiter);
  return limiter;
}

/**
 * Consume a hit on the rate limiter for `key`. Returns the resulting state.
 * Call sites should bail with HTTP 429 (or equivalent) when `allowed=false`.
 */
export async function consume(
  key: string,
  max: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const limiter = getUpstashLimiter(max, windowMs);
  if (limiter) {
    try {
      const r = await limiter.limit(key);
      return {
        allowed: r.success,
        remaining: r.remaining,
        reset: r.reset,
        source: 'upstash',
      };
    } catch {
      // Upstash REST hiccup — fall through to memory rather than 500.
    }
  }
  return memoryConsume(key, max, windowMs);
}

/**
 * Convenience helper for /api/auth/*: 5 attempts per 5 minutes per IP+route
 * is the default for login/signup/forgot/reset, well below typical brute
 * force thresholds.
 */
export async function consumeAuthLimit(scope: string, ip: string) {
  return consume(`auth:${scope}:${ip}`, 5, 5 * 60 * 1000);
}

/** For tests. */
export function _resetMemoryRateLimiter() {
  buckets.clear();
}
