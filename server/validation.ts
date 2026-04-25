import { z } from "zod";

export const promoSchema = z.object({
  caseNumber: z.string().min(1),
  orderNumber: z.string().optional(),
  countryId: z.string().min(1),
  value: z.number(),
  customerEmail: z.string().email(),
  customerName: z.string().optional(),
  reason: z.string().optional(),
  promoType: z.string(),
  forceDuplicate: z.boolean().optional(),
  approvedBy: z.string().optional(),
  agentId: z.string().optional()
});

export const componentSchema = z.object({
  paymentMethod: z.string(),
  amount: z.number().min(0.01),
  externalRef: z.string().optional().nullable(),
});

export const caseSchema = z.object({
  caseNumber: z.string().min(1),
  countryId: z.string().min(1),
  branchId: z.string().min(1),
  customerName: z.string().min(2),
  customerEmail: z.string().email(),
  customerPhone: z.string().min(5),
  orderNumber: z.string().min(3),
  orderDate: z.string(),
  orderAmount: z.number().min(0.01),
  partialAmount: z.number().optional().nullable(),
  paymentMethod: z.string().optional(),
  authCode: z.string().optional().nullable(),
  auraPoints: z.string().optional().nullable(),
  rootCauseId: z.string().min(1),
  refundReason: z.string().min(1),
  brandId: z.string().optional().nullable(),
  components: z.array(componentSchema).optional()
}).refine(data => {
  // If no components provided but legacy paymentMethod is KNET, authCode is needed
  if (!data.components || data.components.length === 0) {
    if (data.paymentMethod === 'KNET') {
      return !!data.authCode && data.authCode.length >= 4;
    }
  }
  return true;
}, {
  message: "Auth Code is mandatory for KNET payments (min 4 chars)",
  path: ["authCode"]
});


export const userSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'AGENT']),
  countryId: z.string().optional()
});
