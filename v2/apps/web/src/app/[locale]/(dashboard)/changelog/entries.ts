/**
 * Source of truth for the changelog. Imported by both the /changelog page
 * and the dismissible top-bar banner so the latest entry stays in sync.
 */

export interface ChangelogEntry {
  version: string;
  date: string;
  type: 'feature' | 'improvement' | 'fix';
  title: string;
  details: string[];
}

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: 'v0.43',
    date: '2026-04-27',
    type: 'feature',
    title: 'Bulk operations, scheduled reports, dashboard sparklines',
    details: [
      'New /operations/bulk-cases route with multi-select, submit-drafts / cancel / reassign actions, and per-row failure reporting.',
      'Resend FAILED emails on /admin/email-log — single-row and "Resend all FAILED" bulk action capped at 200.',
      'Scheduled reports admin at /admin/scheduled-reports with cron sweep at /api/cron/scheduled-reports (every 5 min).',
      'KPI cards on the dashboard now include a 14-day sparkline driven by RefundCase + AuditLog flow events.',
    ],
  },
  {
    version: 'v0.42',
    date: '2026-04-27',
    type: 'feature',
    title: 'Reports, SLA tracking, fraud signals',
    details: [
      'New Reports area: Cases, Refunds, SLA, Agents, Countries, Audit, Emails — each with filters and Excel export.',
      'SLA engine with configurable rules per country/brand and breach/warning cron sweeps.',
      'Fraud signals admin to manage detection thresholds.',
      'Notifications inbox with mark-as-read and per-user preferences.',
      'Saved views on Cases for quick filter recall.',
      'Help Desk → Stores Communication for templated outreach.',
    ],
  },
  {
    version: 'v0.40',
    date: '2026-04-26',
    type: 'improvement',
    title: 'Promo Code UX round 3',
    details: [
      'Rebuilt allocation success popup per DESIGN.md.',
      'Recently allocated by you ribbon on the allocate page.',
      'Country-first pools board with split history view.',
      'Pool detail page with code list, fraud signal preview, and admin controls.',
    ],
  },
  {
    version: 'v0.30',
    date: '2026-04-25',
    type: 'feature',
    title: 'Refund Operations Desk',
    details: [
      'Approval Batches, KNET Batches, and Aura Batches workflows.',
      'ARN suggestions, batch picker, KNET batch detail with line-level ARN entry.',
      'Aura sidecar lifecycle: pending → in batch → completed.',
    ],
  },
  {
    version: 'v0.20',
    date: '2026-04-24',
    type: 'feature',
    title: 'Refund cases — list, detail, and state machine',
    details: [
      'Case create flow with ticket reference and component breakdown.',
      'Case detail tabs: Overview, Components, Notes, Activity.',
      'Status transitions: DRAFT → PENDING_APPROVAL → APPROVED → IN_EXECUTION → REFUNDED.',
      'Notes with @mentions and ActivityLog timeline.',
    ],
  },
  {
    version: 'v0.10',
    date: '2026-04-23',
    type: 'feature',
    title: 'Foundation',
    details: [
      'Monorepo with Next.js 15, tRPC, Prisma 6, Auth.js v5, Tailwind, next-intl.',
      'Authentication with credentials + admin approval flow.',
      'Admin panels: Users, Pending Approvals, Countries, Brands, Payment Methods.',
      'Bilingual UI (EN + AR with full RTL).',
    ],
  },
];

export const LATEST_CHANGELOG = CHANGELOG_ENTRIES[0]!;
