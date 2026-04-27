import { describe, it, expect } from 'vitest';
import { parseApprovalReply } from './parse-reply';

describe('lib/batches/parseApprovalReply', () => {
  it('extracts per-case decisions from a list', () => {
    const out = parseApprovalReply(
      `REF-KW-2026-000123 approved
       REF-KW-2026-000124 rejected
       REF-KW-2026-000125 approved`,
    );
    expect(out.perCase).toEqual([
      { caseNumber: 'REF-KW-2026-000123', decision: 'APPROVED' },
      { caseNumber: 'REF-KW-2026-000124', decision: 'REJECTED' },
      { caseNumber: 'REF-KW-2026-000125', decision: 'APPROVED' },
    ]);
    expect(out.blanket).toBeNull();
  });

  it('treats a body with no case numbers but a decision as blanket', () => {
    const out = parseApprovalReply('approved, please proceed');
    expect(out.perCase).toEqual([]);
    expect(out.blanket).toBe('APPROVED');
  });

  it('blanket reject wins over approve in mixed-decision blanket bodies', () => {
    const out = parseApprovalReply(
      'I had previously approved this, but I now reject the request.',
    );
    expect(out.perCase).toEqual([]);
    expect(out.blanket).toBe('REJECTED');
  });

  it('skips lines with case numbers but no decision keyword', () => {
    const out = parseApprovalReply(
      `REF-KW-2026-000200 see attached receipt
       REF-KW-2026-000201 approved`,
    );
    expect(out.perCase).toEqual([
      { caseNumber: 'REF-KW-2026-000201', decision: 'APPROVED' },
    ]);
  });

  it('deduplicates per-case decisions if the same case appears twice', () => {
    const out = parseApprovalReply(
      `REF-KW-2026-000300 approved
       REF-KW-2026-000300 rejected`,
    );
    expect(out.perCase).toEqual([
      { caseNumber: 'REF-KW-2026-000300', decision: 'APPROVED' },
    ]);
  });

  it('returns no decisions for a body with no signal', () => {
    const out = parseApprovalReply('thanks, will discuss in standup');
    expect(out.perCase).toEqual([]);
    expect(out.blanket).toBeNull();
  });

  it('groups multiple case numbers on the same line under one decision', () => {
    const out = parseApprovalReply(
      'REF-KW-2026-000400 REF-KW-2026-000401 — approved',
    );
    expect(out.perCase).toEqual([
      { caseNumber: 'REF-KW-2026-000400', decision: 'APPROVED' },
      { caseNumber: 'REF-KW-2026-000401', decision: 'APPROVED' },
    ]);
  });
});
