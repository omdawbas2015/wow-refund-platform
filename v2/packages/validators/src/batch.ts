import { z } from 'zod';
import { nonEmptyString } from './common';

// ─────────────────────────────────────────────────────────────────────────
//  APPROVAL BATCHES
// ─────────────────────────────────────────────────────────────────────────

export const createApprovalBatchSchema = z.object({
  countryId: nonEmptyString,
  // Either form accepted: legacy single `recipientEmail` (string) or new
  // multi `recipientEmails` (comma-separated). Both are optional.
  recipientEmail: z.string().trim().email().optional(),
  recipientEmails: z.string().trim().optional().or(z.literal('')),
  scheduledFor: z.coerce.date().optional(),
  // Optional override: only batch the explicitly selected cases. When omitted
  // we batch every PENDING_APPROVAL case in the country that isn't already
  // attached to a live batch.
  caseIds: z.array(nonEmptyString).optional(),
});
export type CreateApprovalBatchInput = z.infer<typeof createApprovalBatchSchema>;

export const sendApprovalBatchSchema = z.object({
  batchId: nonEmptyString,
});
export type SendApprovalBatchInput = z.infer<typeof sendApprovalBatchSchema>;

export const decideApprovalBatchSchema = z.object({
  batchId: nonEmptyString,
  decisions: z
    .array(
      z.object({
        caseId: nonEmptyString,
        decision: z.enum(['APPROVE', 'REJECT']),
        reason: z.string().trim().max(500).optional().or(z.literal('')),
      }),
    )
    .min(1, 'At least one decision is required'),
});
export type DecideApprovalBatchInput = z.infer<typeof decideApprovalBatchSchema>;

export const cancelApprovalBatchSchema = z.object({
  batchId: nonEmptyString,
  reason: z.string().trim().max(500).optional(),
});
export type CancelApprovalBatchInput = z.infer<typeof cancelApprovalBatchSchema>;

export const decideCaseSchema = z.object({
  caseNumber: nonEmptyString,
  decision: z.enum(['APPROVED', 'REJECTED']),
  comment: z.string().trim().max(500).optional(),
});
export type DecideCaseInput = z.infer<typeof decideCaseSchema>;

// ─────────────────────────────────────────────────────────────────────────
//  KNET BATCHES
// ─────────────────────────────────────────────────────────────────────────

export const createKnetBatchSchema = z.object({
  recipientEmail: z.string().trim().email().optional(),
  recipientEmails: z.string().trim().optional().or(z.literal('')),
  scheduledFor: z.coerce.date().optional(),
  // When omitted, the action picks every KNET component currently in
  // PENDING / READY_FOR_BATCH that isn't already attached to a live batch.
  componentIds: z.array(nonEmptyString).optional(),
});
export type CreateKnetBatchInput = z.infer<typeof createKnetBatchSchema>;

export const sendKnetBatchSchema = z.object({
  batchId: nonEmptyString,
});
export type SendKnetBatchInput = z.infer<typeof sendKnetBatchSchema>;

export const verifyComponentArnSchema = z.object({
  componentId: nonEmptyString,
  arn: z
    .string()
    .trim()
    .min(6, 'ARN must be at least 6 characters')
    .max(40, 'ARN must be at most 40 characters'),
});
export type VerifyComponentArnInput = z.infer<typeof verifyComponentArnSchema>;

// Finance approve/reject an ARN previously ingested for a KNET component.
export const verifyKnetArnSchema = z.object({
  componentId: nonEmptyString,
  approve: z.coerce.boolean(),
});
export type VerifyKnetArnInput = z.infer<typeof verifyKnetArnSchema>;

// Bulk ARN ingestion (manual entry of many components at once).
export const ingestKnetArnSchema = z.object({
  batchId: nonEmptyString,
  arns: z
    .array(
      z.object({
        componentId: nonEmptyString,
        arn: z.string().trim().min(6).max(40),
      }),
    )
    .min(1, 'At least one ARN is required'),
});
export type IngestKnetArnInput = z.infer<typeof ingestKnetArnSchema>;

// ─────────────────────────────────────────────────────────────────────────
//  AURA BATCHES
// ─────────────────────────────────────────────────────────────────────────

export const createAuraBatchSchema = z.object({
  recipientEmail: z.string().trim().email().optional(),
  recipientEmails: z.string().trim().optional().or(z.literal('')),
  scheduledFor: z.coerce.date().optional(),
  caseIds: z.array(nonEmptyString).optional(),
});
export type CreateAuraBatchInput = z.infer<typeof createAuraBatchSchema>;

export const confirmAuraCaseSchema = z.object({
  caseId: nonEmptyString,
  status: z.enum(['COMPLETED', 'FAILED']),
  failureReason: z.string().trim().max(500).optional(),
});
export type ConfirmAuraCaseInput = z.infer<typeof confirmAuraCaseSchema>;

// ─────────────────────────────────────────────────────────────────────────
//  REPLY PARSING — EN + AR keyword sets
// ─────────────────────────────────────────────────────────────────────────

/**
 * Words that mean "approved" in any of the locales we care about. Case- and
 * accent-insensitive matching is the caller's responsibility.
 */
export const APPROVE_KEYWORDS = [
  'approved',
  'approve',
  'approving',
  'accepted',
  'accept',
  'ok',
  'okay',
  'yes',
  'confirmed',
  'confirm',
  'sign off',
  'signed off',
  'موافق',
  'موافقة',
  'تم الموافقة',
  'مقبول',
  'موافقتي',
  'نعم',
  'نوافق',
] as const;

export const REJECT_KEYWORDS = [
  'rejected',
  'reject',
  'rejecting',
  'declined',
  'decline',
  'denied',
  'deny',
  'no',
  'cancel',
  'cancelled',
  'not approved',
  'مرفوض',
  'رفض',
  'مرفوضة',
  'غير موافق',
  'لا',
  'لا أوافق',
  'إلغاء',
] as const;

// Latin-letter ASCII word boundary. We can't rely on `\b` because the email
// body may contain Arabic, which `\b` doesn't understand — instead we require
// that any Latin keyword be flanked by either a non-letter or a string edge.
const LATIN_LETTER = /[a-z]/;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function containsKeyword(haystack: string, keyword: string): boolean {
  const kw = keyword.toLowerCase();
  if (!kw) return false;

  // For Arabic / non-Latin keywords, regex word boundaries don't apply.
  // Substring is fine because the keywords are intentionally distinct words
  // ("موافق", "مرفوض", …) that don't appear as prefixes inside other Arabic
  // tokens we care about.
  const isLatin = LATIN_LETTER.test(kw);
  if (!isLatin) return haystack.includes(kw);

  // For Latin keywords (especially short ones like "no", "ok", "yes") we
  // require a non-letter boundary on both sides so that "approved", "noted",
  // "token", "another", … don't false-match.
  const re = new RegExp(`(^|[^a-z])${escapeRegex(kw)}(?=[^a-z]|$)`, 'i');
  return re.test(haystack);
}

/**
 * Best-effort intent classifier. Returns the first decision keyword found,
 * or `null` when neither side is unambiguously signaled. Safe to call on any
 * line of free-form email text — non-matching lines short-circuit to `null`.
 */
export function classifyDecision(text: string): 'APPROVED' | 'REJECTED' | null {
  const normalised = text
    .toLowerCase()
    .replace(/[\s\u00A0]+/g, ' ')
    .trim();
  if (!normalised) return null;

  const hasReject = REJECT_KEYWORDS.some((kw) => containsKeyword(normalised, kw));
  const hasApprove = APPROVE_KEYWORDS.some((kw) => containsKeyword(normalised, kw));

  // Reject wins on conflict — safer to require an explicit re-approve than
  // to silently approve something that contained the word "rejected".
  if (hasReject) return 'REJECTED';
  if (hasApprove) return 'APPROVED';
  return null;
}

/**
 * Match a refund case number anywhere in a line. The format is
 * `REF-<country alpha-2>-<year>-<6-digit seq>` (see seed.ts).
 */
export const CASE_NUMBER_REGEX = /\bREF-[A-Z]{2}-\d{4}-\d{6}\b/g;

/**
 * Match an approval batch number — `APB-<country>-<year>-<seq>`.
 */
export const APPROVAL_BATCH_NUMBER_REGEX = /\bAPB-[A-Z]{2}-\d{4}-\d{4,}\b/g;

/**
 * Match a KNET batch number — `KNET-<year>-<seq>`.
 */
export const KNET_BATCH_NUMBER_REGEX = /\bKNET-\d{4}-\d{4,}\b/g;

/**
 * Match an Aura batch number — `AURA-<year>-<seq>`.
 */
export const AURA_BATCH_NUMBER_REGEX = /\bAURA-\d{4}-\d{4,}\b/g;
