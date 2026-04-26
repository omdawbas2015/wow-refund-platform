import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { buildSingleSheetXlsx, attachmentDisposition, XLSX_MIME } from '@/lib/exports/xlsx';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Export a single KNET batch as an .xlsx file. Finance uses this to upload
 * to the bank's portal, and Ops uses it as a paper trail. Only Admin /
 * Finance Lead / Ops Lead can call this endpoint.
 */
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'FINANCE_LEAD' && role !== 'OPS_LEAD') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const { id } = await ctx.params;
  const batch = await prisma.knetBatch.findUnique({
    where: { id },
    include: {
      components: {
        orderBy: { createdAt: 'asc' },
        include: {
          case: {
            select: {
              caseNumber: true,
              customerName: true,
              customerEmail: true,
              orderNumber: true,
              orderDate: true,
              country: { select: { registryCode: true } },
              brand: { select: { slug: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!batch) {
    return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
  }

  interface Row {
    countryCode: string;
    caseNumber: string;
    customerName: string;
    customerEmail: string;
    orderNumber: string;
    orderDate: Date;
    brand: string;
    authCode: string;
    arn: string;
    amount: number;
    currency: string;
    status: string;
    refundedAt: Date | null;
  }

  const rows: Row[] = batch.components.map((c) => ({
    countryCode: c.case.country.registryCode,
    caseNumber: c.case.caseNumber,
    customerName: c.case.customerName,
    customerEmail: c.case.customerEmail,
    orderNumber: c.case.orderNumber,
    orderDate: c.case.orderDate,
    brand: c.case.brand.name,
    authCode: c.authCode ?? '',
    arn: c.arn ?? '',
    amount: c.amount,
    currency: c.currency,
    status: c.status,
    refundedAt: c.refundedAt,
  }));

  const xlsx = await buildSingleSheetXlsx<Row>({
    name: batch.batchNumber,
    columns: [
      { header: 'Country', key: 'countryCode', width: 8 },
      { header: 'Case', key: 'caseNumber', width: 22 },
      { header: 'Customer', key: 'customerName', width: 24 },
      { header: 'Email', key: 'customerEmail', width: 28 },
      { header: 'Order', key: 'orderNumber', width: 18 },
      { header: 'Order date', key: 'orderDate', width: 14, numFmt: 'yyyy-mm-dd' },
      { header: 'Brand', key: 'brand', width: 16 },
      { header: 'Auth code', key: 'authCode', width: 16 },
      { header: 'ARN', key: 'arn', width: 18 },
      { header: 'Amount', key: 'amount', width: 12, numFmt: '#,##0.000' },
      { header: 'Currency', key: 'currency', width: 8 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Refunded at', key: 'refundedAt', width: 18, numFmt: 'yyyy-mm-dd hh:mm' },
    ],
    rows,
  });

  return new NextResponse(xlsx, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': attachmentDisposition(`${batch.batchNumber}.xlsx`),
      'Cache-Control': 'no-store',
    },
  });
}
