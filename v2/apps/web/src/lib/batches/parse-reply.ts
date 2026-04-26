import { CASE_NUMBER_REGEX, classifyDecision } from '@wow/validators';

export interface DecisionEntry {
  caseNumber: string;
  decision: 'APPROVED' | 'REJECTED';
  comment?: string;
}

export interface ParsedApprovalReply {
  perCase: DecisionEntry[];
  // When the manager replies in bulk ("approved" / "rejected" with no list),
  // we return the blanket decision so the caller can apply it to every case
  // currently attached to the batch.
  blanket: 'APPROVED' | 'REJECTED' | null;
}

/**
 * Parse a manager's email reply for approve/reject decisions.
 *
 * Strategy:
 *  - For every line containing one or more case numbers, classify the line.
 *  - If only one case number appears across the entire reply (or none at all)
 *    and the body classifies cleanly, treat it as a blanket decision.
 *  - Otherwise return per-case decisions and let the caller decide.
 */
export function parseApprovalReply(rawBody: string): ParsedApprovalReply {
  const lines = rawBody.split(/\r?\n/);
  const perCase: DecisionEntry[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const numbers = Array.from(line.matchAll(CASE_NUMBER_REGEX)).map(
      (m) => m[0],
    );
    if (numbers.length === 0) continue;
    const decision = classifyDecision(line);
    if (!decision) continue;

    for (const caseNumber of numbers) {
      if (seen.has(caseNumber)) continue;
      seen.add(caseNumber);
      perCase.push({ caseNumber, decision });
    }
  }

  // Blanket fallback: no case numbers but a clear decision in the body.
  let blanket: 'APPROVED' | 'REJECTED' | null = null;
  if (perCase.length === 0) {
    blanket = classifyDecision(rawBody);
  }

  return { perCase, blanket };
}
