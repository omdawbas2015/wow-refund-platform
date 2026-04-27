import { describe, it, expect } from 'vitest';
import { formatPromoValue, promoTypeLabel, promoTypeShortLabel } from './format';

describe('lib/promo/format', () => {
  describe('formatPromoValue', () => {
    it('SERVICE_RECOVERY always renders "100% off" (value ignored)', () => {
      expect(formatPromoValue('SERVICE_RECOVERY', 100, 'KWD')).toBe('100% off');
      // Even if some legacy row stored a different number we still
      // show 100% \u2014 the schema comment guarantees the field is ignored
      // for service recovery.
      expect(formatPromoValue('SERVICE_RECOVERY', 50, 'USD')).toBe('100% off');
    });

    it('CUSTOMER_COMPENSATION renders as money in the given currency', () => {
      expect(formatPromoValue('CUSTOMER_COMPENSATION', 25, 'USD', 'en-US')).toMatch(/25\.00/);
      expect(formatPromoValue('CUSTOMER_COMPENSATION', 12.345, 'KWD', 'en-US')).toMatch(/12\.345/);
    });
  });

  describe('promoTypeLabel', () => {
    it('long-form labels per type', () => {
      expect(promoTypeLabel('SERVICE_RECOVERY')).toBe('Service recovery');
      expect(promoTypeLabel('CUSTOMER_COMPENSATION')).toBe('Customer compensation');
    });
  });

  describe('promoTypeShortLabel', () => {
    it('short-form labels per type', () => {
      expect(promoTypeShortLabel('SERVICE_RECOVERY')).toBe('Recovery');
      expect(promoTypeShortLabel('CUSTOMER_COMPENSATION')).toBe('Compensation');
    });
  });
});
