import { NextRequest, NextResponse } from 'next/server';
import { prisma, type CaseStatus } from '@wow/db';
import { auth } from '@/auth';
import { buildSingleSheetXlsx, attachmentDisposition, XLSX_MIME } from '@/lib/exports/xlsx';
import {
  pickSlaRule,
  classifyByHours,
  hoursBetween,
  type SlaTierHours,
} from '@/lib/cases/sla-rules';

export const dynamic = 'force-dynamic';

const TERMINAL: CaseStatus[] = ['REFUNDED', 'REJECTED', 'CANCELLED'];

interface Row {
  caseNumber: string;
  status: string;
  countryCode: string;
  brand: string;
  customerEmail: string;
  createdAt: Date;
  elapsedHours: number;
  thresholdHours: number;
  warningHours: number | null;
  overrunHours: number;
  tier: SlaTierHours;
  ruleName: string;
  assignee: string;
}

/**
 * Open refund cases classified against the active SLA rules. Optional
 * `tier=breached|warning|on_track` query param filters the export. Default
 * is `breached` because that is what ops cares about exporting.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD' && role !== 'FINANCE_LEAD') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const rawTier = sp.get('tier') ?? 'breached';
  const tierFilter: SlaTierHours | 'all' =
    rawTier === 'warning' || rawTier === 'on_track' || rawTier === 'all'
      ? (rawTier as SlaTierHours | 'all')
      : 'breached';

  const now = new Date();
  const [rules, cases] = await Promise.all([
    prisma.slaRule.findMany({ where: { isActive: true } }),
    prisma.refundCase.findMany({
      where: { deletedAt: null, status: { notIn: TERMINAL } },
      orderBy: { createdAt: 'asc' },
      select: {
        caseNumber: true,
        status: true,
        customerEmail: true,
        createdAt: true,
        countryId: true,
        brandId: true,
        rootCauseId: true,
        country: { select: { registryCode: true } },
        brand: { select: { name: true } },
        assignedTo: { select: { name: true, email: true } },
      },
    }),
  ]);

  const rows: Row[] = [];
  for (const c of cases) {
    const resolved = pickSlaRule(rules, {
      countryId: c.countryId,
      brandId: c.brandId,
      rootCauseId: c.rootCauseId,
    });
    const elapsedHours = hoursBetween(c.createdAt, now);
    const tier = classifyByHours(elapsedHours, resolved);
    if (tierFilter !== 'all' && tier !== tierFilter) continue;
    rows.push({
      caseNumber: c.caseNumber,
      status: c.status,
      countryCode: c.country.registryCode,
      brand: c.brand.name,
      customerEmail: c.customerEmail,
      createdAt: c.createdAt,
      elapsedHours: Math.round(elapsedHours),
      thresholdHours: resolved.thresholdHours,
      warningHours: resolved.warningHours,
      overrunHours: Math.round(Math.max(0, elapsedHours - resolved.thresholdHours)),
      tier,
      ruleName: resolved.rule?.name ?? 'default',
      assignee: c.assignedTo?.name ?? c.assignedTo?.email ?? '',
    });
  }

  rows.sort((a, b) => b.overrunHours - a.overrunHours || b.elapsedHours - a.elapsedHours);

  const xlsx = await buildSingleSheetXlsx<Row>({
    name: 'SLA',
    columns: [
      { header: 'Case', key: 'caseNumber', width: 22 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Country', key: 'countryCode', width: 8 },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Customer', key: 'customerEmail', width: 28 },
      { header: 'Created', key: 'createdAt', width: 18, numFmt: 'yyyy-mm-dd hh:mm' },
      { header: 'Elapsed (h)', key: 'elapsedHours', width: 12 },
      { header: 'Threshold (h)', key: 'thresholdHours', width: 14 },
      { header: 'Warning (h)', key: 'warningHours', width: 12 },
      { header: 'Overrun (h)', key: 'overrunHours', width: 12 },
      { header: 'Tier', key: 'tier', width: 12 },
      { header: 'Rule', key: 'ruleName', width: 24 },
      { header: 'Assignee', key: 'assignee', width: 24 },
    ],
    rows,
  });

  const filename = `sla-${tierFilter}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new NextResponse(xlsx, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': attachmentDisposition(filename),
      'Cache-Control': 'no-store',
    },
  });
}
