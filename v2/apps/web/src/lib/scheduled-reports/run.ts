/**
 * Run a single ScheduledReport: aggregate the requested scope, render an
 * email summary, dispatch it to each recipient, and persist `lastRunAt`.
 * Returns a per-recipient delivery breakdown plus the row count summarised.
 *
 * Runs via the admin "Run now" action and the /api/cron/scheduled-reports
 * sweep — both share the same code path.
 */

import { prisma } from '@wow/db';
import { dispatchEmail } from '@/lib/email/dispatcher';

export interface ScheduledReportRow {
  id: string;
  name: string;
  scope: string;
  filters: string;
  recipients: string;
  format: string;
}

export interface ReportRunResult {
  ok: boolean;
  rowsSummarised: number;
  recipientsDelivered: number;
  recipientsFailed: number;
  error?: string;
}

interface CasesFilters {
  countryId?: string;
  status?: string;
  fromDays?: number;
}

interface PromoFilters {
  countryId?: string;
  fromDays?: number;
}

function safeParseFilters<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}

function splitRecipients(recipients: string): string[] {
  return recipients
    .split(',')
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

async function buildCasesSummary(filters: CasesFilters): Promise<{
  body: string;
  subjectSuffix: string;
  rows: number;
}> {
  const since = filters.fromDays
    ? new Date(Date.now() - filters.fromDays * 86400_000)
    : null;
  const where: Record<string, unknown> = { deletedAt: null };
  if (filters.countryId) where['countryId'] = filters.countryId;
  if (filters.status) where['status'] = filters.status;
  if (since) where['createdAt'] = { gte: since };

  const [total, byStatus, totalAmount] = await Promise.all([
    prisma.refundCase.count({ where }),
    prisma.refundCase.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
    prisma.refundCase.aggregate({
      where,
      _sum: { totalRefundAmount: true },
    }),
  ]);

  const lines: string[] = [];
  lines.push(`Refund cases summary`);
  lines.push(`Window: ${filters.fromDays ? `last ${filters.fromDays} days` : 'all time'}`);
  if (filters.countryId) lines.push(`Country filter: ${filters.countryId}`);
  if (filters.status) lines.push(`Status filter: ${filters.status}`);
  lines.push('');
  lines.push(`Total cases: ${fmt(total)}`);
  lines.push(`Total refund amount: ${fmt(totalAmount._sum.totalRefundAmount ?? 0)}`);
  lines.push('');
  lines.push(`By status:`);
  for (const row of byStatus.sort((a, b) => b._count._all - a._count._all)) {
    lines.push(`  - ${row.status}: ${fmt(row._count._all)}`);
  }

  return {
    body: lines.join('\n'),
    subjectSuffix: `${fmt(total)} cases`,
    rows: total,
  };
}

async function buildPromosSummary(filters: PromoFilters): Promise<{
  body: string;
  subjectSuffix: string;
  rows: number;
}> {
  const since = filters.fromDays
    ? new Date(Date.now() - filters.fromDays * 86400_000)
    : null;
  const where: Record<string, unknown> = {};
  if (since) where['createdAt'] = { gte: since };

  const [total, byStatus] = await Promise.all([
    prisma.promoCode.count({ where }),
    prisma.promoCode.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    }),
  ]);

  const lines: string[] = [];
  lines.push('Promo codes summary');
  lines.push(`Window: ${filters.fromDays ? `last ${filters.fromDays} days` : 'all time'}`);
  lines.push('');
  lines.push(`Total promo codes: ${fmt(total)}`);
  lines.push('');
  lines.push(`By status:`);
  for (const row of byStatus.sort((a, b) => b._count._all - a._count._all)) {
    lines.push(`  - ${row.status}: ${fmt(row._count._all)}`);
  }

  return {
    body: lines.join('\n'),
    subjectSuffix: `${fmt(total)} codes`,
    rows: total,
  };
}

async function buildDashboardSummary(): Promise<{
  body: string;
  subjectSuffix: string;
  rows: number;
}> {
  const [total, pending, refunded, agents] = await Promise.all([
    prisma.refundCase.count({ where: { deletedAt: null } }),
    prisma.refundCase.count({
      where: { deletedAt: null, status: 'PENDING_APPROVAL' },
    }),
    prisma.refundCase.count({ where: { deletedAt: null, status: 'REFUNDED' } }),
    prisma.user.count({ where: { status: 'ACTIVE', deletedAt: null } }),
  ]);

  const lines: string[] = [
    'Daily WOW Refund snapshot',
    '',
    `Total cases:       ${fmt(total)}`,
    `Pending approval:  ${fmt(pending)}`,
    `Completed refunds: ${fmt(refunded)}`,
    `Active users:      ${fmt(agents)}`,
  ];

  return {
    body: lines.join('\n'),
    subjectSuffix: `${fmt(total)} cases tracked`,
    rows: total,
  };
}

export async function runScheduledReport(
  report: ScheduledReportRow,
): Promise<ReportRunResult> {
  try {
    let summary;
    if (report.scope === 'CASES') {
      summary = await buildCasesSummary(safeParseFilters<CasesFilters>(report.filters));
    } else if (report.scope === 'PROMOS') {
      summary = await buildPromosSummary(safeParseFilters<PromoFilters>(report.filters));
    } else {
      summary = await buildDashboardSummary();
    }

    const recipients = splitRecipients(report.recipients);
    if (recipients.length === 0) {
      return {
        ok: false,
        rowsSummarised: summary.rows,
        recipientsDelivered: 0,
        recipientsFailed: 0,
        error: 'No recipients configured',
      };
    }

    let delivered = 0;
    let failed = 0;
    for (const to of recipients) {
      try {
        const result = await dispatchEmail({
          templateKey: 'scheduled_report.summary',
          to,
          variables: {},
          override: {
            subject: `[WOW Refund] ${report.name} — ${summary.subjectSuffix}`,
            body: summary.body,
          },
          context: { type: 'SYSTEM', id: report.id },
        });
        if (result.delivered) delivered += 1;
        else failed += 1;
      } catch (err) {
        failed += 1;
        console.error(`[scheduled-reports] dispatch failed for ${to}:`, err);
      }
    }

    await prisma.scheduledReport.update({
      where: { id: report.id },
      data: { lastRunAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        actorId: null,
        actorEmail: 'system',
        action: 'scheduled_report.run',
        entityType: 'SCHEDULED_REPORT',
        entityId: report.id,
        metadata: JSON.stringify({
          scope: report.scope,
          rows: summary.rows,
          recipients: recipients.length,
          delivered,
          failed,
        }),
      },
    });

    return {
      ok: true,
      rowsSummarised: summary.rows,
      recipientsDelivered: delivered,
      recipientsFailed: failed,
    };
  } catch (err) {
    return {
      ok: false,
      rowsSummarised: 0,
      recipientsDelivered: 0,
      recipientsFailed: 0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
