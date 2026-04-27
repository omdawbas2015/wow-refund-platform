import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('lib/logger', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    delete process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'test';
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('emits at the right console method per level', async () => {
    const { logger } = await import('./logger');
    logger.info('hello');
    logger.warn('careful');
    logger.error('boom');
    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('respects LOG_LEVEL=warn (info is dropped)', async () => {
    process.env.LOG_LEVEL = 'warn';
    const { logger } = await import('./logger');
    logger.debug('skip me');
    logger.info('skip me too');
    logger.warn('keep me');
    expect(logSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('child(bindings) merges fields into every emission', async () => {
    const { logger } = await import('./logger');
    const scoped = logger.child({ requestId: 'abc' });
    scoped.info({ caseId: 'c1' }, 'created');
    expect(logSpy).toHaveBeenCalled();
    const args = logSpy.mock.calls[0]!;
    const tail = args[args.length - 1] as Record<string, unknown>;
    expect(tail).toMatchObject({ requestId: 'abc', caseId: 'c1' });
  });
});
