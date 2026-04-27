import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const findUnique = vi.fn();
const create = vi.fn();
const update = vi.fn();

vi.mock('@wow/db', () => ({
  prisma: {
    emailTemplate: { findUnique: (...args: unknown[]) => findUnique(...args) },
    emailLog: {
      create: (...args: unknown[]) => create(...args),
      update: (...args: unknown[]) => update(...args),
    },
  },
}));

import { dispatchEmail } from './dispatcher';

const fetchMock = vi.fn();

beforeEach(() => {
  findUnique.mockReset();
  create.mockReset();
  update.mockReset();
  fetchMock.mockReset();
  // Default: emailLog.create returns a row with id, update is no-op.
  create.mockResolvedValue({ id: 'log-1' });
  update.mockResolvedValue({});
  vi.stubGlobal('fetch', fetchMock);
  // Silence the dev-mode console banner so tests stay quiet.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lib/email/dispatcher', () => {
  it('uses an override when provided and skips template lookup', async () => {
    const out = await dispatchEmail({
      templateKey: 'unused-because-override',
      to: 'a@example.com',
      variables: {},
      override: { subject: 'Hi', body: 'Body' },
    });
    expect(findUnique).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]?.[0]?.data).toMatchObject({
      to: 'a@example.com',
      subject: 'Hi',
      body: 'Body',
      status: 'PENDING',
    });
    expect(out.delivered).toBe(true);
    expect(out.logId).toBe('log-1');
  });

  it('renders {{placeholders}} from the matched template', async () => {
    findUnique.mockResolvedValue({
      id: 'tpl-1',
      subject: 'Hello {{name}}',
      body: 'Your code is {{code}}',
    });
    await dispatchEmail({
      templateKey: 'AUTH_OTP_PASSWORD_RESET',
      locale: 'en',
      to: 'a@example.com',
      variables: { name: 'Alice', code: '123456' },
    });
    const data = create.mock.calls[0]?.[0]?.data;
    expect(data?.subject).toBe('Hello Alice');
    expect(data?.body).toBe('Your code is 123456');
    expect(data?.templateId).toBe('tpl-1');
  });

  it('throws if the template cannot be found', async () => {
    findUnique.mockResolvedValue(null);
    await expect(
      dispatchEmail({
        templateKey: 'NOPE',
        to: 'a@example.com',
        variables: {},
      }),
    ).rejects.toThrow(/Email template not found/);
    expect(create).not.toHaveBeenCalled();
  });

  it('marks the log SENT in dev mode (no webhook URL set)', async () => {
    vi.stubEnv('POWER_AUTOMATE_WEBHOOK_URL', '');
    // The module captured the env at load time, so re-import for this case.
    vi.resetModules();
    const mod = await import('./dispatcher');
    findUnique.mockResolvedValue({ id: 'tpl-1', subject: 'S', body: 'B' });

    const out = await mod.dispatchEmail({
      templateKey: 'X',
      to: 'a@example.com',
      variables: {},
    });
    expect(out.delivered).toBe(true);
    expect(out.runId).toBe('dev-stub');
    // Update was called twice — once to mark sent.
    const lastUpdate = update.mock.calls.at(-1)?.[0];
    expect(lastUpdate?.data?.status).toBe('SENT');
    expect(lastUpdate?.data?.powerAutomateRunId).toBe('dev-stub');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('persists the context type/id when provided', async () => {
    await dispatchEmail({
      templateKey: 'X',
      to: 'a@example.com',
      variables: {},
      override: { subject: 'S', body: 'B' },
      context: { type: 'CASE', id: 'case-1' },
    });
    expect(create.mock.calls[0]?.[0]?.data).toMatchObject({
      contextType: 'CASE',
      contextId: 'case-1',
    });
  });

  it('writes nullable optional fields as null when omitted', async () => {
    await dispatchEmail({
      templateKey: 'X',
      to: 'a@example.com',
      variables: {},
      override: { subject: 'S', body: 'B' },
    });
    expect(create.mock.calls[0]?.[0]?.data).toMatchObject({
      cc: null,
      bcc: null,
      contextType: null,
      contextId: null,
    });
  });

  it('defaults locale to "en" when omitted', async () => {
    findUnique.mockResolvedValue({ id: 'tpl-1', subject: 'S', body: 'B' });
    await dispatchEmail({
      templateKey: 'X',
      to: 'a@example.com',
      variables: {},
    });
    const where = findUnique.mock.calls[0]?.[0]?.where?.key_locale;
    expect(where?.locale).toBe('en');
  });
});
