/**
 * RBAC seed data.
 * Roles map to sets of permissions. Permissions are fine-grained keys.
 * Admin panel can create custom roles by composing permissions.
 */

export interface PermissionSeed {
  key: string;
  category: string;
  description: string;
}

export interface RoleSeed {
  key: string;
  name: string;
  nameAr: string;
  description: string;
  isSystem: boolean;
  permissions: string[]; // permission keys
}

export const permissions: readonly PermissionSeed[] = [
  // Cases
  { key: 'case.view',           category: 'Cases',    description: 'View refund cases' },
  { key: 'case.view.all',       category: 'Cases',    description: 'View cases across all countries' },
  { key: 'case.create',         category: 'Cases',    description: 'Create a refund case' },
  { key: 'case.edit',           category: 'Cases',    description: 'Edit a refund case' },
  { key: 'case.delete',         category: 'Cases',    description: 'Soft-delete a refund case' },
  { key: 'case.approve',        category: 'Cases',    description: 'Approve a refund case' },
  { key: 'case.reject',         category: 'Cases',    description: 'Reject a refund case' },
  { key: 'case.execute',        category: 'Cases',    description: 'Execute manual refunds (Apple Pay/CC)' },
  { key: 'case.verify_arn',     category: 'Cases',    description: 'Verify ARN suggestions for KNET refunds' },
  { key: 'case.notes.create',   category: 'Cases',    description: 'Add notes to cases' },

  // Batches
  { key: 'batch.view',          category: 'Batches',  description: 'View approval/KNET/Aura batches' },
  { key: 'batch.create',        category: 'Batches',  description: 'Create batches manually' },
  { key: 'batch.send',          category: 'Batches',  description: 'Send batch emails via Power Automate' },

  // Promo
  { key: 'promo.view',          category: 'Promo',    description: 'View promo codes and allocations' },
  { key: 'promo.allocate.compensation', category: 'Promo', description: 'Allocate customer compensation promo codes' },
  { key: 'promo.allocate.service_recovery', category: 'Promo', description: 'Allocate service recovery promo codes' },
  { key: 'promo.upload',        category: 'Promo',    description: 'Upload new promo codes' },
  { key: 'promo.config',        category: 'Promo',    description: 'Manage promo configurations' },

  // Help Desk
  { key: 'store_message.send',  category: 'Help Desk', description: 'Send templated messages to stores' },
  { key: 'store_message.view',  category: 'Help Desk', description: 'View store messages history' },

  // Admin
  { key: 'admin.users.view',    category: 'Admin',    description: 'View user list' },
  { key: 'admin.users.approve', category: 'Admin',    description: 'Approve/reject pending signups' },
  { key: 'admin.users.manage',  category: 'Admin',    description: 'Create/edit/suspend users' },
  { key: 'admin.roles.manage',  category: 'Admin',    description: 'Create/edit roles & permissions' },
  { key: 'admin.countries.manage', category: 'Admin', description: 'Manage active countries' },
  { key: 'admin.branches.manage', category: 'Admin',  description: 'Manage branches' },
  { key: 'admin.brands.manage', category: 'Admin',    description: 'Manage brands' },
  { key: 'admin.payment_methods.manage', category: 'Admin', description: 'Manage payment methods' },
  { key: 'admin.root_causes.manage', category: 'Admin', description: 'Manage root causes' },
  { key: 'admin.email_templates.manage', category: 'Admin', description: 'Manage email templates' },
  { key: 'admin.automation.manage', category: 'Admin', description: 'Manage automation rules' },
  { key: 'admin.sla.manage',    category: 'Admin',    description: 'Manage SLA rules' },
  { key: 'admin.schedules.manage', category: 'Admin', description: 'Manage batch schedules' },
  { key: 'admin.backups.manage', category: 'Admin',   description: 'Manage backups' },
  { key: 'admin.feature_flags.manage', category: 'Admin', description: 'Toggle feature flags' },
  { key: 'admin.settings.manage', category: 'Admin',  description: 'Manage system settings' },
  { key: 'admin.audit.view',    category: 'Admin',    description: 'View audit logs' },

  // Reports
  { key: 'report.view',         category: 'Reports',  description: 'View dashboards and reports' },
  { key: 'report.export',       category: 'Reports',  description: 'Export data to Excel/PDF' },
  { key: 'report.schedule',     category: 'Reports',  description: 'Schedule recurring reports' },
];

// Helper: all permission keys
const ALL = permissions.map((p) => p.key);

export const roles: readonly RoleSeed[] = [
  {
    key: 'ADMIN',
    name: 'Administrator',
    nameAr: 'مدير النظام',
    description: 'Full system access',
    isSystem: true,
    permissions: ALL,
  },
  {
    key: 'MANAGER',
    name: 'Country Manager',
    nameAr: 'مدير قُطري',
    description: 'Approves refund cases for their country',
    isSystem: true,
    permissions: [
      'case.view', 'case.view.all', 'case.approve', 'case.reject', 'case.notes.create',
      'batch.view',
      'promo.view',
      'store_message.view',
      'report.view', 'report.export',
    ],
  },
  {
    key: 'AGENT',
    name: 'Customer Care Agent',
    nameAr: 'موظف خدمة العملاء',
    description: 'Creates refund cases and handles customer issues',
    isSystem: true,
    permissions: [
      'case.view', 'case.create', 'case.edit', 'case.notes.create',
      'promo.view', 'promo.allocate.compensation', 'promo.allocate.service_recovery',
      'store_message.send', 'store_message.view',
      'report.view',
    ],
  },
  {
    key: 'REFUND_AGENT',
    name: 'Refund Operations',
    nameAr: 'موظف عمليات الاسترداد',
    description: 'Executes refunds (enters ARNs, verifies suggestions)',
    isSystem: true,
    permissions: [
      'case.view', 'case.view.all', 'case.execute', 'case.verify_arn', 'case.notes.create',
      'batch.view',
      'report.view', 'report.export',
    ],
  },
  {
    key: 'FINANCE',
    name: 'Finance',
    nameAr: 'المالية',
    description: 'Views KNET batches and confirms ARNs',
    isSystem: true,
    permissions: [
      'case.view', 'case.view.all',
      'batch.view', 'batch.send',
      'report.view', 'report.export',
    ],
  },
  {
    key: 'AUDITOR',
    name: 'Auditor',
    nameAr: 'مدقق',
    description: 'Read-only access to all data and audit logs',
    isSystem: true,
    permissions: [
      'case.view', 'case.view.all',
      'batch.view',
      'promo.view',
      'store_message.view',
      'report.view', 'report.export',
      'admin.audit.view',
    ],
  },
  {
    key: 'READ_ONLY',
    name: 'Read-Only',
    nameAr: 'قراءة فقط',
    description: 'Basic read access',
    isSystem: true,
    permissions: ['case.view', 'report.view'],
  },
];
