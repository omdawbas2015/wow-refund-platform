import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { NextRequest } from 'next/server';

// CRON_SECRET is read at module load. We re-import the module under
// different env values via vi.resetModules + vi.stubEnv.
type VerifyCronAuth = (req: NextRequest) => Awaited<ReturnType<typeof importVerify>> | null;
async function importVerify() {
  const mod = await import('./auth');
  return mod.verifyCronAuth;
}

function makeReq(headers: Record<string, string>): NextRequest {
  return {
    headers: {
      get: (k: string) => headers[k.toLowerCase()] ?? null,
    },
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('lib/cron/auth', () => {
  it('returns a 503 when CRON_SECRET is unset (deployment misconfigured)', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const verify: VerifyCronAuth = (await importVerify()) as VerifyCronAuth;
    const req = makeReq({ 'x-cron-secret': 'whatever' });
    const res = verify(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(503);
  });

  it('accepts the secret in the x-cron-secret header', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const verify: VerifyCronAuth = (await importVerify()) as VerifyCronAuth;
    const req = makeReq({ 'x-cron-secret': 's3cret' });
    expect(verify(req)).toBeNull();
  });

  it('accepts the secret as a Bearer token in Authorization', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const verify: VerifyCronAuth = (await importVerify()) as VerifyCronAuth;
    const req = makeReq({ authorization: 'Bearer s3cret' });
    expect(verify(req)).toBeNull();
  });

  it('rejects with 401 when neither header matches', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const verify: VerifyCronAuth = (await importVerify()) as VerifyCronAuth;
    const req = makeReq({ 'x-cron-secret': 'wrong' });
    const res = verify(req);
    expect(res).not.toBeNull();
    expect(res?.status).toBe(401);
  });

  it('rejects when the secret is missing from both headers', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const verify: VerifyCronAuth = (await importVerify()) as VerifyCronAuth;
    const res = verify(makeReq({}));
    expect(res?.status).toBe(401);
  });

  it('rejects when the bearer prefix is wrong (case is preserved otherwise)', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const verify: VerifyCronAuth = (await importVerify()) as VerifyCronAuth;
    const res = verify(makeReq({ authorization: 'Token s3cret' }));
    expect(res?.status).toBe(401);
  });

  it('handles a Bearer prefix in mixed case', async () => {
    vi.stubEnv('CRON_SECRET', 's3cret');
    const verify: VerifyCronAuth = (await importVerify()) as VerifyCronAuth;
    expect(verify(makeReq({ authorization: 'BEARER s3cret' }))).toBeNull();
    expect(verify(makeReq({ authorization: 'bearer s3cret' }))).toBeNull();
  });

  it('treats unequal secret lengths as a non-match (no length leak via crash)', async () => {
    vi.stubEnv('CRON_SECRET', 'longer-secret');
    const verify: VerifyCronAuth = (await importVerify()) as VerifyCronAuth;
    expect(verify(makeReq({ 'x-cron-secret': 'short' }))?.status).toBe(401);
  });
});
