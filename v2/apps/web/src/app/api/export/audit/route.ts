import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@wow/db';
import { auth } from '@/auth';
import { buildSingleSheetXlsx, attachmentDisposition, XLSX_MIME } from '@/lib/exports/xlsx';

export const dynamic = 'force-dynamic';

/**
 * Admin-only export of audit-log rows. Mirrors the filters available on
 * `/reports/audit`: action, entity type, free-text search (actor email or
 * entity id), and an optional ISO date range (`from` / `to`). Capped at
 * 20 000 rows.
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
  const action = (sp.get('action') ?? '').trim();
  const entity = (sp.get('entity') ?? '').trim();
  const q = (sp.get('q') ?? '').trim();
  const from = parseDate(sp.get('from'));
  const to = parseDate(sp.get('to'), { endOfDay: true });

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action: { contains: action } } : {}),
    ...(entity ? { entityType: entity } : {}),
    ...(q
      ? {
          OR: [
            { actorEmail: { contains: q } },
            { entityId: { contains: q } },
          ],
        }
      : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
  };

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 20_000,
  });

  interface Row {
    createdAt: string;
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    before: string;
    after: string;
  }

  const rows: Row[] = logs.map((l) => ({
    createdAt: l.createdAt.toISOString(),
    actor: l.actorEmail ?? '',
    action: l.action,
    entityType: l.entityType ?? '',
    entityId: l.entityId ?? '',
    before: l.beforeData ?? '',
    after: l.afterData ?? '',
  }));

  const body = await buildSingleSheetXlsx<Row>({
    name: 'Audit log',
    columns: [
      { header: 'Created at (ISO)', key: 'createdAt', width: 26 },
      { header: 'Actor email', key: 'actor', width: 32 },
      { header: 'Action', key: 'action', width: 32 },
      { header: 'Entity type', key: 'entityType', width: 16 },
      { header: 'Entity ID', key: 'entityId', width: 28 },
      { header: 'Before', key: 'before', width: 50 },
      { header: 'After', key: 'after', width: 50 },
    ],
    rows,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, {
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': attachmentDisposition(`audit-log-${stamp}.xlsx`),
    },
  });
}

function parseDate(raw: string | null, opts?: { endOfDay?: boolean }): Date | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s) return undefined;
  // Accept either YYYY-MM-DD or full ISO. For YYYY-MM-DD we anchor to start
  // (or end) of UTC day so the inclusive range matches the on-screen filter.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T${opts?.endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? undefined : d;
}
