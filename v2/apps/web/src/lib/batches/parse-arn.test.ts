import { describe, it, expect } from 'vitest';
import { parseArnReply } from './parse-arn';

describe('lib/batches/parseArnReply', () => {
  it('extracts colon-separated entries', () => {
    const out = parseArnReply(
      `Hello team,

      REF-KW-2026-000123: 12345678
      REF-KW-2026-000124: 23456789

      Best,`,
    );
    expect(out).toEqual([
      { caseNumber: 'REF-KW-2026-000123', arn: '12345678' },
      { caseNumber: 'REF-KW-2026-000124', arn: '23456789' },
    ]);
  });

  it('extracts dash-separated entries', () => {
    const out = parseArnReply('REF-KW-2026-000123 - ARN9988776');
    expect(out).toEqual([{ caseNumber: 'REF-KW-2026-000123', arn: 'ARN9988776' }]);
  });

  it('extracts entries with the literal "ARN" word in between', () => {
    const out = parseArnReply('REF-SA-2026-000001 ARN 87654321');
    expect(out).toEqual([{ caseNumber: 'REF-SA-2026-000001', arn: '87654321' }]);
  });

  it('uppercases case numbers and ARNs', () => {
    const out = parseArnReply('ref-kw-2026-000010: ab12cd34');
    expect(out).toEqual([{ caseNumber: 'REF-KW-2026-000010', arn: 'AB12CD34' }]);
  });

  it('deduplicates if a case number appears twice', () => {
    const out = parseArnReply(
      `REF-KW-2026-000123: 11111111
       REF-KW-2026-000123: 22222222`,
    );
    expect(out).toEqual([{ caseNumber: 'REF-KW-2026-000123', arn: '11111111' }]);
  });

  it('rejects too-short ARN tokens (< 6 chars)', () => {
    const out = parseArnReply('REF-KW-2026-000123: A1B2');
    expect(out).toEqual([]);
  });

  it('returns [] when nothing matches', () => {
    expect(parseArnReply('completely unrelated text')).toEqual([]);
    expect(parseArnReply('')).toEqual([]);
  });

  it('falls back to parallel-list parsing when colon/dash absent', () => {
    const out = parseArnReply(
      `Cases: REF-KW-2026-000200 REF-KW-2026-000201
       ARNs: 12345678 87654321`,
    );
    expect(out).toEqual([
      { caseNumber: 'REF-KW-2026-000200', arn: '12345678' },
      { caseNumber: 'REF-KW-2026-000201', arn: '87654321' },
    ]);
  });
});
