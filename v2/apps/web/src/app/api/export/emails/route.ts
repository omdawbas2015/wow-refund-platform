import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@wow/db';
import { auth } from '@/auth';
import { buildSingleSheetXlsx, attachmentDisposition, XLSX_MIME } from '@/lib/exports/xlsx';

export const dynamic = 'force-dynamic';

const VALID_STATUS = new Set(['PENDING', 'SENT', 'FAILED', 'BOUNCED']);

/**
 * Admin-only export of email-log rows. Honors the same filters as
 * `/reports/emails` plus an optional ISO date range. Capped at 20 000 rows.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'UNAUTHENTICATED' }, { status: 401 });
  }
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const status = (sp.get('status') ?? '').trim();
  const key = (sp.get('key') ?? '').trim();
  const to = (sp.get('to') ?? '').trim();
  const from = parseDate(sp.get('from'));
  const until = parseDate(sp.get('until'), { endOfDay: true });

  const where: Prisma.EmailLogWhereInput = {
    ...(status && VALID_STATUS.has(status) ? { status } : {}),
    ...(key ? { templateKey: key } : {}),
    ...(to ? { to: { contains: to } } : {}),
    ...(from || until
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(until ? { lte: until } : {}),
          },
        }
      : {}),
  };

  const logs = await prisma.emailLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 20_000,
  });

  interface Row {
    createdAt: string;
    sentAt: string;
    status: string;
    templateKey: string;
    to: string;
    cc: string;
    subject: string;
    contextType: string;
    contextId: string;
    failureReason: string;
    runId: string;
  }

  const rows: Row[] = logs.map((l) => ({
    createdAt: l.createdAt.toISOString(),
    sentAt: l.sentAt ? l.sentAt.toISOString() : '',
    status: l.status,
    templateKey: l.templateKey,
    to: l.to,
    cc: l.cc ?? '',
    subject: l.subject,
    contextType: l.contextType ?? '',
    contextId: l.contextId ?? '',
    failureReason: l.failureReason ?? '',
    runId: l.powerAutomateRunId ?? '',
  }));

  const body = await buildSingleSheetXlsx<Row>({
    name: 'Email log',
    columns: [
      { header: 'Created at (ISO)', key: 'createdAt', width: 26 },
      { header: 'Sent at (ISO)', key: 'sentAt', width: 26 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Template', key: 'templateKey', width: 32 },
      { header: 'To', key: 'to', width: 32 },
      { header: 'CC', key: 'cc', width: 32 },
      { header: 'Subject', key: 'subject', width: 50 },
      { header: 'Context type', key: 'contextType', width: 14 },
      { header: 'Context ID', key: 'contextId', width: 28 },
      { header: 'Failure reason', key: 'failureReason', width: 40 },
      { header: 'Run ID', key: 'runId', width: 28 },
    ],
    rows,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': attachmentDisposition(`email-log-${stamp}.xlsx`),
    },
  });
}

function parseDate(raw: string | null, opts?: { endOfDay?: boolean }): Date | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T${opts?.endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
