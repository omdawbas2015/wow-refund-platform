import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { buildSingleSheetXlsx, attachmentDisposition, XLSX_MIME } from '@/lib/exports/xlsx';
import { parseRange } from '@/lib/reports/range';

export const dynamic = 'force-dynamic';

interface Row {
  name: string;
  email: string;
  created: number;
  refunded: number;
  rejected: number;
  refundedAmount: number;
  avgResolutionHours: number | null;
  oldestOpenAgeHours: number | null;
}

/**
 * Per-agent productivity for a date range. Mirrors the on-screen
 * `/reports/agents` page: only emits rows where the agent had at least one
 * created/refunded/rejected case in the range.
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
  const range = parseRange({ from: sp.get('from') ?? undefined, to: sp.get('to') ?? undefined });
  const now = new Date();

  const staff = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { isNot: null } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  });

  const rows: Row[] = await Promise.all(
    staff.map(async (u) => {
      const [createdInRange, refundedRows, rejectedCount, refundedAggr, oldestOpen] =
        await Promise.all([
          prisma.refundCase.count({
            where: {
              createdById: u.id,
              createdAt: { gte: range.from, lte: range.to },
              deletedAt: null,
            },
          }),
          prisma.refundCase.findMany({
            where: {
              createdById: u.id,
              status: 'REFUNDED',
              updatedAt: { gte: range.from, lte: range.to },
              deletedAt: null,
            },
            select: { createdAt: true, updatedAt: true },
          }),
          prisma.refundCase.count({
            where: {
              createdById: u.id,
              status: 'REJECTED',
              updatedAt: { gte: range.from, lte: range.to },
              deletedAt: null,
            },
          }),
          prisma.refundComponent.aggregate({
            where: {
              status: 'REFUNDED',
              refundedAt: { gte: range.from, lte: range.to },
              case: { createdById: u.id, deletedAt: null },
            },
            _sum: { amount: true },
          }),
          prisma.refundCase.findFirst({
            where: {
              OR: [{ assignedToId: u.id }, { createdById: u.id }],
              status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION'] },
              deletedAt: null,
            },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          }),
        ]);

      const refunded = refundedRows.length;
      const avgMs = refunded
        ? refundedRows.reduce(
            (sum, r) => sum + (r.updatedAt.getTime() - r.createdAt.getTime()),
            0,
          ) / refunded
        : null;
      const avgHours = avgMs !== null ? Math.round(avgMs / (1000 * 60 * 60)) : null;
      const oldestOpenAgeHours = oldestOpen
        ? Math.round((now.getTime() - oldestOpen.createdAt.getTime()) / (1000 * 60 * 60))
        : null;

      return {
        name: u.name,
        email: u.email,
        created: createdInRange,
        refunded,
        rejected: rejectedCount,
        refundedAmount: refundedAggr._sum.amount ?? 0,
        avgResolutionHours: avgHours,
        oldestOpenAgeHours,
      };
    }),
  );

  const visible = rows
    .filter((r) => r.created > 0 || r.refunded > 0 || r.rejected > 0)
    .sort((a, b) => b.refunded - a.refunded || b.created - a.created);

  const xlsx = await buildSingleSheetXlsx<Row>({
    name: 'Agents',
    columns: [
      { header: 'Agent', key: 'name', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Created', key: 'created', width: 12 },
      { header: 'Refunded', key: 'refunded', width: 12 },
      { header: 'Rejected', key: 'rejected', width: 12 },
      { header: 'Amount refunded', key: 'refundedAmount', width: 16, numFmt: '#,##0.000' },
      { header: 'Avg resolution (h)', key: 'avgResolutionHours', width: 18 },
      { header: 'Oldest open (h)', key: 'oldestOpenAgeHours', width: 16 },
    ],
    rows: visible,
  });

  const filename = `agents-${range.fromIso}-to-${range.toIso}.xlsx`;
  return new NextResponse(xlsx, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': attachmentDisposition(filename),
      'Cache-Control': 'no-store',
    },
  });
}
