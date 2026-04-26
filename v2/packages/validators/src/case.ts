import { z } from 'zod';
import { emailSchema, nonEmptyString, phoneSchema } from './common';

/**
 * Component on a case at creation time. The auth-code requirement is
 * configurable per payment method (`paymentMethod.requiresAuthCode`) by
 * admins, so it must be enforced server-side where the method records
 * are loaded — not hardcoded against a single key in the schema. The
 * server action `createCaseAction` performs that check after resolving
 * `paymentMethodKey -> PaymentMethod`.
 */
export const refundComponentInputSchema = z.object({
  paymentMethodKey: nonEmptyString,
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  currency: nonEmptyString.length(3),
  authCode: z.string().trim().optional(),
  last4: z
    .string()
    .trim()
    .regex(/^[0-9]{0,4}$/, 'Last 4 must be digits')
    .optional()
    .or(z.literal('')),
});
export type RefundComponentInput = z.infer<typeof refundComponentInputSchema>;

export const createRefundCaseSchema = z.object({
  countryId: nonEmptyString,
  brandId: nonEmptyString,
  branchId: z.string().trim().optional().nullable(),

  customerName: nonEmptyString.max(120),
  customerEmail: emailSchema,
  customerPhone: phoneSchema.optional().or(z.literal('')),
  customerNotes: z.string().trim().max(1000).optional().or(z.literal('')),

  orderNumber: nonEmptyString.max(60),
  orderDate: z.coerce.date(),
  orderAmount: z.coerce.number().positive('Order amount must be positive'),
  orderCurrency: nonEmptyString.length(3),

  rootCauseId: z.string().trim().optional().nullable(),
  rootCauseNotes: z.string().trim().max(1000).optional().or(z.literal('')),

  auraPoints: z.coerce
    .number()
    .int('Aura points must be whole numbers')
    .nonnegative('Aura points cannot be negative')
    .optional()
    .nullable(),

  components: z
    .array(refundComponentInputSchema)
    .min(1, 'At least one refund component is required'),
});
export type CreateRefundCaseInput = z.infer<typeof createRefundCaseSchema>;

export const updateRefundCaseSchema = z.object({
  caseId: nonEmptyString,
  customerName: z.string().trim().max(120).optional(),
  customerEmail: emailSchema.optional(),
  customerPhone: z.string().trim().optional(),
  customerNotes: z.string().trim().max(1000).optional(),
  rootCauseId: z.string().trim().optional().nullable(),
  rootCauseNotes: z.string().trim().max(1000).optional(),
  auraPoints: z.coerce.number().int().nonnegative().optional().nullable(),
});
export type UpdateRefundCaseInput = z.infer<typeof updateRefundCaseSchema>;

export const submitCaseSchema = z.object({
  caseId: nonEmptyString,
});
export type SubmitCaseInput = z.infer<typeof submitCaseSchema>;

export const approveCaseSchema = z.object({
  caseId: nonEmptyString,
});
export type ApproveCaseInput = z.infer<typeof approveCaseSchema>;

export const rejectCaseSchema = z.object({
  caseId: nonEmptyString,
  reason: nonEmptyString.max(500),
});
export type RejectCaseInput = z.infer<typeof rejectCaseSchema>;

export const cancelCaseSchema = z.object({
  caseId: nonEmptyString,
  reason: nonEmptyString.max(500),
});
export type CancelCaseInput = z.infer<typeof cancelCaseSchema>;

export const addCaseNoteSchema = z.object({
  caseId: nonEmptyString,
  body: nonEmptyString.max(4000),
  mentionedUserIds: z.array(z.string().trim().min(1)).max(10).optional().default([]),
});
export type AddCaseNoteInput = z.infer<typeof addCaseNoteSchema>;

export const markComponentRefundedSchema = z.object({
  componentId: nonEmptyString,
  arn: nonEmptyString.max(120),
  notifyCustomer: z.coerce.boolean().optional().default(false),
});
export type MarkComponentRefundedInput = z.infer<typeof markComponentRefundedSchema>;

export const customerLookupSchema = z.object({
  query: nonEmptyString.max(120),
});
export type CustomerLookupInput = z.infer<typeof customerLookupSchema>;

export const caseListFiltersSchema = z.object({
  q: z.string().trim().optional().or(z.literal('')),
  status: z
    .enum([
      'DRAFT',
      'PENDING_APPROVAL',
      'APPROVED',
      'IN_EXECUTION',
      'PARTIALLY_REFUNDED',
      'REFUNDED',
      'REJECTED',
      'CANCELLED',
    ])
    .optional(),
  countryId: z.string().trim().optional().or(z.literal('')),
  brandId: z.string().trim().optional().or(z.literal('')),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});
export type CaseListFilters = z.infer<typeof caseListFiltersSchema>;
