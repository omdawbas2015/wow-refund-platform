/**
 * Display helpers for promo pools and codes.
 *
 * SERVICE_RECOVERY pools store `value: 100` to mean "100% off" — the schema
 * comment in `packages/db/prisma/schema.prisma` says the value is "ignored
 * for SERVICE_RECOVERY (100%)". Rendering that as `formatMoney(100, 'KWD')`
 * (→ "KWD 100.000") is misleading because it looks like a money amount.
 *
 * Always go through `formatPromoValue` so service-recovery codes consistently
 * show as a percentage discount everywhere (pool list, pool detail, allocate
 * form, success card, history list, CSV export).
 */

import { formatMoney } from '@/lib/format';

export type PromoType = 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';

/** "100% off" for service-recovery, formatted money for customer-compensation. */
export function formatPromoValue(
  type: PromoType,
  value: number,
  currency: string,
  locale = 'en-US',
): string {
  if (type === 'SERVICE_RECOVERY') {
    return '100% off';
  }
  return formatMoney(value, currency, locale);
}

/** Short label for the promo type (used in chips / badges). */
export function promoTypeLabel(type: PromoType): string {
  return type === 'SERVICE_RECOVERY' ? 'Service recovery' : 'Customer compensation';
}

/** Single-word label, used in tight spaces. */
export function promoTypeShortLabel(type: PromoType): string {
  return type === 'SERVICE_RECOVERY' ? 'Recovery' : 'Compensation';
}
