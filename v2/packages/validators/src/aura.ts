import { z } from 'zod';
import { nonEmptyString } from './common';

export const createAuraBatchSchema = z.object({
  caseIds: z.array(nonEmptyString).min(1).max(500),
  scheduledFor: z.coerce.date(),
  recipientEmails: z.string().trim().optional().or(z.literal('')),
});
export type CreateAuraBatchInput = z.infer<typeof createAuraBatchSchema>;

export const sendAuraBatchSchema = z.object({
  batchId: nonEmptyString,
});
export type SendAuraBatchInput = z.infer<typeof sendAuraBatchSchema>;

export const completeAuraBatchSchema = z.object({
  batchId: nonEmptyString,
  responseRawBody: z.string().trim().optional().or(z.literal('')),
});
export type CompleteAuraBatchInput = z.infer<typeof completeAuraBatchSchema>;

export const cancelAuraBatchSchema = z.object({
  batchId: nonEmptyString,
  reason: z.string().trim().min(1).max(500),
});
export type CancelAuraBatchInput = z.infer<typeof cancelAuraBatchSchema>;
