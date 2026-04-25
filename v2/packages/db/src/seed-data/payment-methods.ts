/**
 * Default payment methods.
 * Admin can add more from the admin panel (Tabby, Tamara, PayPal, QPay, etc.).
 *
 * Credit cards are modeled as two separate network-level methods (VISA and
 * MASTERCARD) so a case shows the actual brand the customer tapped, not a
 * generic "Credit Card" chip.
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
    key: 'MASTERCARD',
    label: 'Mastercard',
    labelAr: 'ماستركارد',
    iconSlug: 'mastercard',
    color: '#000000',
    requiresAuthCode: false,
    executionType: 'MANUAL',
    sortOrder: 10,
  },
  {
    key: 'APPLE_PAY',
    label: 'Apple Pay',
    labelAr: 'آبل باي',
    iconSlug: 'apple-pay',
    color: '#000000',
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
