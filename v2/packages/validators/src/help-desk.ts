import { z } from 'zod';
import { nonEmptyString } from './common';

export const sendStoreMessageSchema = z.object({
  templateId: nonEmptyString,
  storeEmail: z.string().trim().email(),
  caseNumber: z.string().trim().min(1).max(64),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type SendStoreMessageInput = z.infer<typeof sendStoreMessageSchema>;

export const upsertStoreMessageTemplateSchema = z.object({
  templateId: nonEmptyString.optional(),
  key: nonEmptyString.max(64),
  label: nonEmptyString.max(120),
  labelAr: z.string().trim().max(120).optional().or(z.literal('')),
  subject: nonEmptyString.max(300),
  body: nonEmptyString.max(8_000),
  isActive: z.coerce.boolean(),
  sortOrder: z.coerce.number().int().min(0).default(0),
});
export type UpsertStoreMessageTemplateInput = z.infer<typeof upsertStoreMessageTemplateSchema>;
