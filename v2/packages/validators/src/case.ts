import { z } from 'zod';
import { emailSchema, nonEmptyString, phoneSchema } from './common';

export const caseStatuses = [
  'DRAFT',
  'PENDING_APPROVAL',
  'APPROVED',
  'IN_EXECUTION',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'REJECTED',
  'CANCELLED',
] as const;
export const caseStatusSchema = z.enum(caseStatuses);
export type CaseStatusValue = (typeof caseStatuses)[number];

export const auraStatuses = ['NONE', 'PENDING', 'COMPLETED', 'FAILED'] as const;
export const auraStatusSchema = z.enum(auraStatuses);

/**
 * A refund case captures exactly one payment method — the network the
 * customer tapped. We don't split a refund across multiple rails, and we
 * don't store card numbers (agents only pick a brand). KNET carries an
 * auth code; everything else doesn't.
 */
export const refundComponentInput = z.object({
  paymentMethodId: nonEmptyString,
  amount: z.coerce.number().positive('Amount must be greater than zero'),
  authCode: z.string().trim().optional().nullable(),
});
export type RefundComponentInput = z.infer<typeof refundComponentInput>;

/**
 * Input schema for creating a new refund case.
 * Server action validates this, generates the case number, and creates the row
 * plus its components in a transaction.
 */
export const createCaseSchema = z.object({
  countryId: nonEmptyString,
  branchId: z.string().trim().optional().nullable(),
  brandId: nonEmptyString,

  customerName: nonEmptyString.max(200),
  customerEmail: emailSchema,
  customerPhone: phoneSchema.optional().or(z.literal('')).transform((v) => (v ? v : null)),
  customerNotes: z.string().trim().max(2000).optional().nullable(),

  orderNumber: nonEmptyString.max(64),
  orderDate: z.coerce.date(),
  orderAmount: z.coerce.number().positive(),
  orderCurrency: z.string().trim().length(3),

  // Exactly one payment component. Validated as a length-1 array so the
  // shape stays aligned with the `case_component` table (1-N in schema)
  // and we keep the door open for split-payment later without a migration.
  components: z
    .array(refundComponentInput)
    .length(1, 'A case must record exactly one payment method'),

  auraPoints: z.coerce.number().int().nonnegative().optional().nullable(),

  rootCauseId: z.string().trim().optional().nullable(),
  rootCauseNotes: z.string().trim().max(2000).optional().nullable(),

  // acknowledges a duplicate warning — set to true to bypass
  duplicateAcknowledged: z.coerce.boolean().optional(),
});
export type CreateCaseInput = z.infer<typeof createCaseSchema>;

/**
 * List filters (all optional). Server action reads these from URL search params.
 */
export const caseListFiltersSchema = z.object({
  q: z.string().trim().optional(),
  countryId: z.string().trim().optional(),
  brandId: z.string().trim().optional(),
  status: caseStatusSchema.optional(),
  assignedToId: z.string().trim().optional(),
  fromDate: z.coerce.date().optional(),
  // Date-only inputs (YYYY-MM-DD) coerce to midnight UTC; for `toDate` we
  // want the filter to be inclusive of the entire end day, so push it to
  // 23:59:59.999 of that day. Datetime strings that already carry a time
  // component are left untouched.
  toDate: z.coerce
    .date()
    .optional()
    .transform((d) => {
      if (!d) return d;
      const sameMidnight =
        d.getUTCHours() === 0 &&
        d.getUTCMinutes() === 0 &&
        d.getUTCSeconds() === 0 &&
        d.getUTCMilliseconds() === 0;
      if (!sameMidnight) return d;
      const end = new Date(d);
      end.setUTCHours(23, 59, 59, 999);
      return end;
    }),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type CaseListFilters = z.infer<typeof caseListFiltersSchema>;

export const addNoteSchema = z.object({
  caseId: nonEmptyString,
  body: z.string().trim().min(1, 'Note cannot be empty').max(4000),
  mentionedUserIds: z.array(z.string()).optional().default([]),
});
export type AddNoteInput = z.infer<typeof addNoteSchema>;

export const updateCaseStatusSchema = z.object({
  caseId: nonEmptyString,
  target: caseStatusSchema,
  reason: z.string().trim().max(2000).optional(),
});
export type UpdateCaseStatusInput = z.infer<typeof updateCaseStatusSchema>;

/**
 * State machine definition. Maps each status to the set of allowed targets.
 * Kept small; business-logic guards live in the server action.
 */
export const CASE_STATE_TRANSITIONS: Record<CaseStatusValue, CaseStatusValue[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['IN_EXECUTION', 'CANCELLED'],
  IN_EXECUTION: ['PARTIALLY_REFUNDED', 'REFUNDED', 'CANCELLED'],
  PARTIALLY_REFUNDED: ['REFUNDED', 'CANCELLED'],
  REFUNDED: [],
  REJECTED: [],
  CANCELLED: [],
};

export function canTransition(from: CaseStatusValue, to: CaseStatusValue): boolean {
  return CASE_STATE_TRANSITIONS[from].includes(to);
}
