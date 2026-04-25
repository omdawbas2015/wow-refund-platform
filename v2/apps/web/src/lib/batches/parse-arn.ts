import { CASE_NUMBER_REGEX } from '@wow/validators';

export interface ParsedArnEntry {
  caseNumber: string;
  arn: string;
}

/**
 * Extract `<caseNumber>: <ARN>` style entries from a free-form Finance reply.
 *
 * Matches both colon and dash separators on the same line, plus a fallback
 * pattern where the case number and the ARN sit on adjacent words.
 *
 * Examples that all parse to `{ caseNumber: 'REF-KW-2026-000123', arn: '12345678' }`:
 *   `REF-KW-2026-000123: 12345678`
 *   `REF-KW-2026-000123 - 12345678`
 *   `REF-KW-2026-000123 ARN 12345678`
 */
export function parseArnReply(rawBody: string): ParsedArnEntry[] {
  const entries: ParsedArnEntry[] = [];
  const seen = new Set<string>();

  // 1. Per-line pattern: case number then ARN with a clear separator.
  const lineRegex =
    /(REF-[A-Z]{2}-\d{4}-\d{6})[\s:\-–—]+(?:ARN[\s:\-–—]+)?([A-Z0-9][A-Z0-9\-]{4,39})/gi;
  for (const match of rawBody.matchAll(lineRegex)) {
    const caseNumber = match[1]?.toUpperCase();
    const arn = match[2]?.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!caseNumber || !arn || arn.length < 6) continue;
    if (seen.has(caseNumber)) continue;
    seen.add(caseNumber);
    entries.push({ caseNumber, arn });
  }

  // 2. Fallback — case numbers and ARN-shaped tokens listed in parallel
  //    (rare, but keeps us robust to weirdly formatted spreadsheets).
  if (entries.length === 0) {
    const caseNumbers = Array.from(rawBody.matchAll(CASE_NUMBER_REGEX)).map(
      (m) => m[0],
    );
    const arnRegex = /\b[A-Z0-9]{8,20}\b/g;
    const arns = Array.from(rawBody.toUpperCase().matchAll(arnRegex))
      .map((m) => m[0])
      .filter((token) => /\d/.test(token) && /[A-Z0-9]/.test(token))
      .filter((token) => !/^REF/.test(token));

    if (caseNumbers.length > 0 && caseNumbers.length === arns.length) {
      for (let i = 0; i < caseNumbers.length; i++) {
        const caseNumber = caseNumbers[i]!;
        const arn = arns[i]!;
        if (seen.has(caseNumber)) continue;
        seen.add(caseNumber);
        entries.push({ caseNumber, arn });
      }
    }
  }

  return entries;
}
