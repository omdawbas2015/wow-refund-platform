import { z } from 'zod';
import { nonEmptyString } from './common';

// ─────────────────────────────────────────────────────────────────────────
//  PROMO ALLOCATION
// ─────────────────────────────────────────────────────────────────────────

export const promoTypeEnum = z.enum(['CUSTOMER_COMPENSATION', 'SERVICE_RECOVERY']);
export type PromoTypeValue = z.infer<typeof promoTypeEnum>;

export const allocatePromoSchema = z
  .object({
    poolId: nonEmptyString,
    customerEmail: z.string().trim().toLowerCase().email(),
    customerName: z.string().trim().max(120).optional().or(z.literal('')),
    caseId: nonEmptyString.optional().or(z.literal('')),
    reason: z.string().trim().max(500).optional().or(z.literal('')),
    /**
     * The agent must explicitly confirm they reviewed the customer's
     * promo history when a fraud signal is present (recent allocations).
     */
    fraudSignalAcknowledged: z.boolean().optional(),
  })
  .transform((v) => ({
    ...v,
    customerName: v.customerName?.trim() || undefined,
    caseId: v.caseId?.trim() || undefined,
    reason: v.reason?.trim() || undefined,
  }));

export type AllocatePromoInput = z.infer<typeof allocatePromoSchema>;

// ─────────────────────────────────────────────────────────────────────────
//  PROMO CODE UPLOAD
// ─────────────────────────────────────────────────────────────────────────

/** Normalize pasted code list — one per line, trim, unique, uppercase-ish. */
export function parsePromoCodesText(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of raw.split(/\r?\n|,|;/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.length > 64) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export const uploadPromoCodesSchema = z.object({
  poolId: nonEmptyString,
  /** Pre-parsed list of unique, trimmed codes. */
  codes: z.array(z.string().min(1).max(64)).min(1).max(5000),
  expiresAt: z.union([z.string().datetime(), z.null()]).optional(),
});
export type UploadPromoCodesInput = z.infer<typeof uploadPromoCodesSchema>;
