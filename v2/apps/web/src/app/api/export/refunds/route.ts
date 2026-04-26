import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { parseRange } from '@/lib/reports/range';
import { buildSingleSheetXlsx, attachmentDisposition, XLSX_MIME } from '@/lib/exports/xlsx';

export const dynamic = 'force-dynamic';

/**
 * Refunded-components export for a date range. Mirrors the
 * `/reports/refunds` page but emits .xlsx instead of HTML, and is capped at
 * 10 000 rows to keep memory bounded. Excludes soft-deleted cases (must
 * match the report's filter to avoid number drift).
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
  const range = parseRange({
    from: sp.get('from') ?? undefined,
    to: sp.get('to') ?? undefined,
  });

  const refunded = await prisma.refundComponent.findMany({
    where: {
      status: 'REFUNDED',
      refundedAt: { gte: range.from, lte: range.to },
      case: { deletedAt: null },
    },
    orderBy: { refundedAt: 'asc' },
    take: 10_000,
    include: {
      paymentMethod: { select: { label: true } },
      case: {
        select: {
          caseNumber: true,
          customerName: true,
          customerEmail: true,
          orderNumber: true,
          country: { select: { registryCode: true } },
          brand: { select: { name: true } },
        },
      },
    },
  });

  interface Row {
    refundedAt: Date | null;
    countryCode: string;
    brand: string;
    caseNumber: string;
    customerName: string;
    customerEmail: string;
    orderNumber: string;
    paymentMethod: string;
    authCode: string;
    arn: string;
    amount: number;
    currency: string;
  }

  const rows: Row[] = refunded.map((c) => ({
    refundedAt: c.refundedAt,
    countryCode: c.case.country.registryCode,
    brand: c.case.brand.name,
    caseNumber: c.case.caseNumber,
    customerName: c.case.customerName,
    customerEmail: c.case.customerEmail,
    orderNumber: c.case.orderNumber,
    paymentMethod: c.paymentMethod.label,
    authCode: c.authCode ?? '',
    arn: c.arn ?? '',
    amount: c.amount,
    currency: c.currency,
  }));

  const xlsx = await buildSingleSheetXlsx<Row>({
    name: `Refunds ${range.fromIso}-${range.toIso}`,
    columns: [
      { header: 'Refunded at', key: 'refundedAt', width: 18, numFmt: 'yyyy-mm-dd hh:mm' },
      { header: 'Country', key: 'countryCode', width: 8 },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Case', key: 'caseNumber', width: 22 },
      { header: 'Customer', key: 'customerName', width: 24 },
      { header: 'Email', key: 'customerEmail', width: 28 },
      { header: 'Order', key: 'orderNumber', width: 18 },
      { header: 'Method', key: 'paymentMethod', width: 12 },
      { header: 'Auth', key: 'authCode', width: 16 },
      { header: 'ARN', key: 'arn', width: 18 },
      { header: 'Amount', key: 'amount', width: 12, numFmt: '#,##0.000' },
      { header: 'Currency', key: 'currency', width: 8 },
    ],
    rows,
  });

  return new NextResponse(xlsx, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': attachmentDisposition(
        `refunds-${range.fromIso}-to-${range.toIso}.xlsx`,
      ),
      'Cache-Control': 'no-store',
    },
  });
}
