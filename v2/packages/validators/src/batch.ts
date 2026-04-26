import { z } from 'zod';
import { nonEmptyString } from './common';

// ── Approval batches ──────────────────────────────────────────────────────

export const createApprovalBatchSchema = z.object({
  countryId: nonEmptyString,
  caseIds: z.array(nonEmptyString).min(1, 'Select at least one case'),
  scheduledFor: z.coerce.date().optional(),
  recipientEmails: z.string().trim().optional().or(z.literal('')),
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
  reason: nonEmptyString.max(500),
});
export type CancelApprovalBatchInput = z.infer<typeof cancelApprovalBatchSchema>;

// ── KNET batches ──────────────────────────────────────────────────────────

export const createKnetBatchSchema = z.object({
  componentIds: z.array(nonEmptyString).min(1, 'Select at least one component'),
  scheduledFor: z.coerce.date().optional(),
  recipientEmails: z.string().trim().optional().or(z.literal('')),
});
export type CreateKnetBatchInput = z.infer<typeof createKnetBatchSchema>;

export const sendKnetBatchSchema = z.object({
  batchId: nonEmptyString,
});
export type SendKnetBatchInput = z.infer<typeof sendKnetBatchSchema>;

export const ingestKnetArnSchema = z.object({
  batchId: nonEmptyString,
  arns: z
    .array(
      z.object({
        componentId: nonEmptyString,
        arn: nonEmptyString.max(120),
      }),
    )
    .min(1),
});
export type IngestKnetArnInput = z.infer<typeof ingestKnetArnSchema>;

export const verifyKnetArnSchema = z.object({
  componentId: nonEmptyString,
  approve: z.coerce.boolean(),
});
export type VerifyKnetArnInput = z.infer<typeof verifyKnetArnSchema>;
