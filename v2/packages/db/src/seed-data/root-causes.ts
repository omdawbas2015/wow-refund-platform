export interface RootCauseSeed {
  key: string;
  label: string;
  labelAr: string;
  category: string;
  requiresEvidence: boolean;
  sortOrder: number;
}

export const rootCauses: readonly RootCauseSeed[] = [
  { key: 'DAMAGED_ITEM',       label: 'Damaged item',          labelAr: 'منتج تالف',         category: 'Quality',  requiresEvidence: true,  sortOrder: 10 },
  { key: 'WRONG_ITEM',         label: 'Wrong item delivered',  labelAr: 'منتج خاطئ',          category: 'Quality',  requiresEvidence: true,  sortOrder: 20 },
  { key: 'MISSING_ITEM',       label: 'Missing item',          labelAr: 'منتج ناقص',          category: 'Quality',  requiresEvidence: false, sortOrder: 30 },
  { key: 'LATE_DELIVERY',      label: 'Late delivery',         labelAr: 'تأخر التوصيل',      category: 'Shipping', requiresEvidence: false, sortOrder: 40 },
  { key: 'NOT_DELIVERED',      label: 'Not delivered',         labelAr: 'لم يتم التوصيل',   category: 'Shipping', requiresEvidence: false, sortOrder: 50 },
  { key: 'QUALITY_ISSUE',      label: 'Quality issue',         labelAr: 'مشكلة في الجودة',  category: 'Quality',  requiresEvidence: true,  sortOrder: 60 },
  { key: 'CUSTOMER_REQUEST',   label: 'Customer request',      labelAr: 'طلب العميل',         category: 'Customer', requiresEvidence: false, sortOrder: 70 },
  { key: 'DUPLICATE_ORDER',    label: 'Duplicate order',       labelAr: 'طلب مكرر',          category: 'Customer', requiresEvidence: false, sortOrder: 80 },
  { key: 'PAYMENT_ISSUE',      label: 'Payment issue',         labelAr: 'مشكلة في الدفع',   category: 'Customer', requiresEvidence: false, sortOrder: 90 },
  { key: 'OTHER',              label: 'Other',                 labelAr: 'أخرى',              category: 'Other',    requiresEvidence: false, sortOrder: 999 },
];
