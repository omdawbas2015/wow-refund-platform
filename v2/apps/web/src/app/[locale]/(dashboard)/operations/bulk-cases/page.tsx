import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BulkCasesPanel, type BulkCaseRow } from './bulk-cases-panel';

const BULK_ROLES = new Set(['ADMIN', 'MANAGER', 'AGENT']);

export const dynamic = 'force-dynamic';

export default async function BulkCasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!BULK_ROLES.has(session.user.role ?? '')) redirect('/');

  const sp = await searchParams;
  const statusParam = typeof sp['status'] === 'string' ? sp['status'] : '';
  const countryParam = typeof sp['countryId'] === 'string' ? sp['countryId'] : '';
  const q = typeof sp['q'] === 'string' ? sp['q'].trim() : '';

  const allowedStatuses = [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'IN_EXECUTION',
    'PARTIALLY_REFUNDED',
  ] as const;
  const status = (allowedStatuses as readonly string[]).includes(statusParam)
    ? statusParam
    : 'DRAFT';

  const where: Record<string, unknown> = {
    deletedAt: null,
    status,
  };
  if (countryParam) where['countryId'] = countryParam;
  if (q) {
    const isPg = (process.env.DATABASE_URL ?? '').startsWith('postgres');
    const ciContains = (value: string) =>
      isPg ? { contains: value, mode: 'insensitive' as const } : { contains: value };
    where['OR'] = [
      { caseNumber: ciContains(q) },
      { customerName: ciContains(q) },
      { customerEmail: ciContains(q) },
      { orderNumber: ciContains(q) },
    ];
  }

  const [countries, agents, cases] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      include: { registry: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.user.findMany({
      where: { status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true, email: true, role: { select: { key: true } } },
      orderBy: { name: 'asc' },
    }),
    prisma.refundCase.findMany({
      where,
      include: {
        country: { include: { registry: true } },
        brand: true,
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
  ]);

  const rows: BulkCaseRow[] = cases.map((c) => ({
    id: c.id,
    caseNumber: c.caseNumber,
    status: c.status,
    customerName: c.customerName,
    customerEmail: c.customerEmail,
    countryName: c.country.registry.nameEn,
    countryFlag: c.country.registry.flag ?? '',
    brandName: c.brand?.name ?? '—',
    totalAmount: Number(c.totalRefundAmount ?? 0),
    currency: c.orderCurrency,
    assignedTo: c.assignedTo
      ? { id: c.assignedTo.id, name: c.assignedTo.name }
      : null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-display-3 font-semibold tracking-tight">
          Bulk operations
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit, cancel, or reassign many cases at once. Stays out of the main /cases workspace.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select cases</CardTitle>
          <CardDescription>
            Filter by status, country, or text — pick rows with the checkboxes — then run a
            bulk action. Failed rows are reported individually so a single conflict cannot
            abort the rest of the batch.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BulkCasesPanel
            initialFilters={{ status, countryId: countryParam, q }}
            countries={countries.map((c) => ({
              id: c.id,
              name: c.registry.nameEn,
              flag: c.registry.flag ?? '',
            }))}
            agents={agents.map((a) => ({
              id: a.id,
              name: a.name,
              email: a.email,
              role: a.role?.key ?? null,
            }))}
            rows={rows}
            currentUserRole={session.user.role ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
