/**
 * Default email templates — editable from admin panel.
 * Placeholders use {{variable}} syntax.
 */

export interface EmailTemplateSeed {
  key: string;
  category: string;
  locale: string;
  subject: string;
  body: string;
  placeholders: string[];
  description: string;
}

export const emailTemplates: readonly EmailTemplateSeed[] = [
  // ─── Auth ───
  {
    key: 'AUTH_OTP_PASSWORD_RESET',
    category: 'Auth',
    locale: 'en',
    subject: 'Your WOW Refund password reset code',
    body:
      'Hi {{name}},\n\nYour verification code is: {{code}}\n\nThis code expires in {{ttl}} minutes. If you did not request this, please ignore this email.\n\n— WOW Refund',
    placeholders: ['name', 'code', 'ttl'],
    description: 'Sent when a user requests a password reset.',
  },
  {
    key: 'AUTH_OTP_PASSWORD_RESET',
    category: 'Auth',
    locale: 'ar',
    subject: 'رمز إعادة تعيين كلمة المرور',
    body:
      'مرحباً {{name}}،\n\nرمز التحقق الخاص بك: {{code}}\n\nينتهي هذا الرمز خلال {{ttl}} دقيقة. إذا لم تطلب إعادة تعيين كلمة المرور، تجاهل هذه الرسالة.\n\n— WOW Refund',
    placeholders: ['name', 'code', 'ttl'],
    description: 'Arabic version of password reset OTP.',
  },
  {
    key: 'AUTH_ADMIN_NEW_SIGNUP',
    category: 'Auth',
    locale: 'en',
    subject: '[WOW Refund] New signup awaiting approval: {{email}}',
    body:
      'A new user has signed up and is awaiting approval:\n\nName: {{name}}\nEmail: {{email}}\nSubmitted: {{submittedAt}}\n\nReview and approve at: {{approvalUrl}}',
    placeholders: ['name', 'email', 'submittedAt', 'approvalUrl'],
    description: 'Sent to admins when a new user signs up.',
  },
  {
    key: 'AUTH_SIGNUP_APPROVED',
    category: 'Auth',
    locale: 'en',
    subject: 'Your WOW Refund account has been approved',
    body:
      'Hi {{name}},\n\nYour account has been approved. You can now log in and set your password.\n\nLogin: {{loginUrl}}\n\n— WOW Refund',
    placeholders: ['name', 'loginUrl'],
    description: 'Sent to the user when admin approves their signup.',
  },

  // ─── Approval Batch ───
  {
    key: 'APPROVAL_BATCH_MANAGER',
    category: 'Manager',
    locale: 'en',
    subject: '[WOW Refund] Daily approval batch — {{country}} — {{date}} ({{count}} cases)',
    body:
      'Dear {{managerName}},\n\nYou have {{count}} refund case(s) awaiting your approval for {{country}} on {{date}}.\n\nApproval table:\n{{casesTable}}\n\nTotal amount: {{totalAmount}}\n\nTo approve: reply with "approved" followed by case numbers, or click the link below.\nTo reject: reply with "rejected" and the reason.\n\nApproval link: {{approvalUrl}}\n\n— WOW Refund',
    placeholders: ['managerName', 'country', 'date', 'count', 'casesTable', 'totalAmount', 'approvalUrl'],
    description: 'Sent daily to country managers with pending approvals.',
  },

  // ─── KNET Batch ───
  {
    key: 'KNET_BATCH_FINANCE',
    category: 'Finance',
    locale: 'en',
    subject: '[WOW Refund] KNET refund batch — {{date}} ({{count}} transactions)',
    body:
      'Dear Finance team,\n\nPlease process {{count}} KNET refunds for {{date}}.\n\nBatch details:\n{{componentsTable}}\n\nTotal amount: {{totalAmount}}\n\nAfter processing, please reply with the ARN for each transaction.\n\nExpected format:\n{{expectedFormat}}\n\n— WOW Refund',
    placeholders: ['date', 'count', 'componentsTable', 'totalAmount', 'expectedFormat'],
    description: 'Sent daily to Finance team with approved KNET refunds awaiting ARN.',
  },

  // ─── Aura Batch ───
  {
    key: 'AURA_BATCH_TEAM',
    category: 'Aura',
    locale: 'en',
    subject: '[WOW Refund] Aura points refund — {{date}} ({{count}} orders)',
    body:
      'Dear Aura team,\n\nPlease process {{count}} Aura point refund(s) for {{date}}.\n\nOrders:\n{{ordersTable}}\n\nTotal points: {{totalPoints}}\n\nPlease confirm each order after processing.\n\n— WOW Refund',
    placeholders: ['date', 'count', 'ordersTable', 'totalPoints'],
    description: 'Sent daily to Aura team with pending point refunds.',
  },

  // ─── Customer ───
  {
    key: 'CUSTOMER_REFUND_COMPLETED',
    category: 'Customer',
    locale: 'en',
    subject: 'Your refund for order {{orderNumber}} has been processed',
    body:
      'Dear {{customerName}},\n\nYour refund for order {{orderNumber}} has been processed.\n\nRefund details:\n{{componentsTable}}\n\nTotal refunded: {{totalAmount}}\n\nPayment reference: {{arn}}\n\nPlease allow 3-7 business days for the amount to reflect in your account.\n\nThank you for shopping with {{brandName}}.\n\n— The {{brandName}} Team',
    placeholders: ['customerName', 'orderNumber', 'componentsTable', 'totalAmount', 'arn', 'brandName'],
    description: 'Sent to customer when their refund is completed.',
  },
  {
    key: 'CUSTOMER_REFUND_COMPLETED',
    category: 'Customer',
    locale: 'ar',
    subject: 'تم معالجة استرداد الطلب {{orderNumber}}',
    body:
      'عزيزي {{customerName}}،\n\nتم معالجة استرداد قيمة طلبك رقم {{orderNumber}}.\n\nتفاصيل الاسترداد:\n{{componentsTable}}\n\nالإجمالي: {{totalAmount}}\n\nرقم المرجع: {{arn}}\n\nقد يستغرق ظهور المبلغ في حسابك من 3 إلى 7 أيام عمل.\n\nشكراً لتسوقك من {{brandName}}.\n\n— فريق {{brandName}}',
    placeholders: ['customerName', 'orderNumber', 'componentsTable', 'totalAmount', 'arn', 'brandName'],
    description: 'Arabic version of customer refund completed email.',
  },
  {
    key: 'CUSTOMER_PROMO_COMPENSATION',
    category: 'Customer',
    locale: 'en',
    subject: 'A little something from {{brandName}}',
    body:
      'Dear {{customerName}},\n\nWe apologize for the inconvenience you experienced.\n\nAs a goodwill gesture, please use the following code on your next order at {{brandName}}:\n\nCode: {{promoCode}}\nValue: {{value}} {{currency}}\nExpires: {{expiresAt}}\n\nWe hope to serve you better next time.\n\n— The {{brandName}} Team',
    placeholders: ['customerName', 'brandName', 'promoCode', 'value', 'currency', 'expiresAt'],
    description: 'Sent with a customer compensation promo code.',
  },
];
