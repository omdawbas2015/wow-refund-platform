/**
 * Templated issue categories for Stores Communication tool.
 * Purely isolated: no auto-fill from refund cases.
 */

export interface StoreMessageTemplateSeed {
  key: string;
  label: string;
  labelAr: string;
  subject: string;
  body: string;
  sortOrder: number;
}

export const storeMessageTemplates: readonly StoreMessageTemplateSeed[] = [
  {
    key: 'NO_ASSET_ID',
    label: 'No Asset ID provided',
    labelAr: 'لم يتم تقديم رقم الأصول',
    subject: '[Case {{caseNumber}}] No Asset ID provided',
    body:
      'Dear Store team,\n\nRegarding case {{caseNumber}}, no Asset ID was provided. Please share the Asset ID so we can proceed with the refund.\n\n{{note}}\n\nThank you,\nWOW Refund team',
    sortOrder: 10,
  },
  {
    key: 'NO_DESCRIPTION',
    label: 'No description provided',
    labelAr: 'لا يوجد وصف',
    subject: '[Case {{caseNumber}}] No description provided',
    body:
      'Dear Store team,\n\nRegarding case {{caseNumber}}, no description of the issue was provided. Please share the details so we can help resolve this.\n\n{{note}}\n\nThank you,\nWOW Refund team',
    sortOrder: 20,
  },
  {
    key: 'SOURCE_OF_LEAKAGE',
    label: 'Source of the leakage',
    labelAr: 'مصدر التسرب',
    subject: '[Case {{caseNumber}}] Source of the leakage',
    body:
      'Dear Store team,\n\nRegarding case {{caseNumber}}, we need to identify the source of the leakage. Please investigate and share your findings.\n\n{{note}}\n\nThank you,\nWOW Refund team',
    sortOrder: 30,
  },
  {
    key: 'NOT_UNDER_OUR_SCOPE',
    label: 'Not under our scope',
    labelAr: 'خارج نطاقنا',
    subject: '[Case {{caseNumber}}] Not under our scope',
    body:
      'Dear Store team,\n\nRegarding case {{caseNumber}}, this issue falls outside our scope. Please handle it through the appropriate channel.\n\n{{note}}\n\nThank you,\nWOW Refund team',
    sortOrder: 40,
  },
];
