/**
 * Default payment methods.
 * Admin can add more from the admin panel (Mada, Tabby, Tamara, PayPal, etc.).
 */

export interface PaymentMethodSeed {
  key: string;
  label: string;
  labelAr: string;
  iconSlug: string;
  color: string;
  requiresAuthCode: boolean;
  executionType: 'MANUAL' | 'BATCH';
  sortOrder: number;
}

export const paymentMethods: readonly PaymentMethodSeed[] = [
  {
    key: 'APPLE_PAY',
    label: 'Apple Pay',
    labelAr: 'آبل باي',
    iconSlug: 'apple-pay',
    color: '#000000',
    requiresAuthCode: false,
    executionType: 'MANUAL',
    sortOrder: 10,
  },
  {
    key: 'CREDIT_CARD',
    label: 'Credit Card',
    labelAr: 'بطاقة ائتمان',
    iconSlug: 'credit-card',
    color: '#1a1f36',
    requiresAuthCode: false,
    executionType: 'MANUAL',
    sortOrder: 20,
  },
  {
    key: 'KNET',
    label: 'KNET',
    labelAr: 'كي نت',
    iconSlug: 'knet',
    color: '#00a651',
    requiresAuthCode: true,
    executionType: 'BATCH',
    sortOrder: 30,
  },
];
