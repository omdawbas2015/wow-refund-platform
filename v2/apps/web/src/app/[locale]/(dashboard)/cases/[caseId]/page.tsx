import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import { CaseStatusBadge, ComponentStatusBadge } from '@/components/ui/case-status-badge';
import { formatDate, formatDateTime, formatMoney, relativeTime } from '@/lib/format';
import { CaseTabs } from './case-tabs';

export const dynamic = 'force-dynamic';

export default async function CaseDetailsPage({
  params,
}: {
  params: Promise<{ locale: string; caseId: string }>;
}) {
  const { locale, caseId } = await params;
  const session = await auth();

  const refundCase = await prisma.refundCase.findUnique({
    where: { id: caseId },
    include: {
      country: { include: { registry: true } },
      brand: true,
      branch: true,
      rootCause: true,
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      components: {
        include: { paymentMethod: true },
        orderBy: { createdAt: 'asc' },
      },
      notes: {
        where: { deletedAt: null },
        include: {
          author: { select: { id: true, name: true } },
          mentions: { include: { user: { select: { id: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!refundCase) {
    notFound();
  }

  const role = session?.user?.role ?? null;
  const canApprove = role === 'ADMIN' || role === 'MANAGER';
  const isDeleted = !!refundCase.deletedAt;

  // For @mention picker: list active users
  const mentionableUsers = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, id: { not: session?.user?.id } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
    take: 100,
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-4">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/cases`}>
            <ChevronLeft className="h-4 w-4" />
            Back to cases
          </Link>
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-display-sm font-normal tracking-tight text-heading font-mono">
              {refundCase.caseNumber}
            </h1>
            <CaseStatusBadge status={refundCase.status} />
            {refundCase.isPartial && (
              <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
                Partial
              </span>
            )}
          </div>
          <p className="mt-1 text-body">
            {refundCase.customerName} ·{' '}
            <span className="text-muted-foreground">{refundCase.customerEmail}</span>
          </p>
        </div>
        <div className="text-end text-sm text-muted-foreground">
          <div>
            {refundCase.country.registry.flag ?? '🌐'} {refundCase.country.registry.nameEn} ·{' '}
            {refundCase.brand.name}
          </div>
          <div>Created {formatDateTime(refundCase.createdAt)}</div>
        </div>
      </div>

      <CaseTabs
        locale={locale}
        caseData={{
          id: refundCase.id,
          caseNumber: refundCase.caseNumber,
          status: refundCase.status,
          customerName: refundCase.customerName,
          customerEmail: refundCase.customerEmail,
          customerPhone: refundCase.customerPhone,
          customerNotes: refundCase.customerNotes,
          orderNumber: refundCase.orderNumber,
          orderDate: refundCase.orderDate.toISOString(),
          orderAmount: refundCase.orderAmount,
          orderCurrency: refundCase.orderCurrency,
          totalRefundAmount: refundCase.totalRefundAmount,
          isPartial: refundCase.isPartial,
          auraPoints: refundCase.auraPoints,
          auraStatus: refundCase.auraStatus,
          rootCause: refundCase.rootCause?.label ?? null,
          rootCauseNotes: refundCase.rootCauseNotes,
          brandName: refundCase.brand.name,
          countryName: refundCase.country.registry.nameEn,
          countryFlag: refundCase.country.registry.flag ?? '',
          branchName: refundCase.branch?.name ?? null,
          createdBy: refundCase.createdBy
            ? { id: refundCase.createdBy.id, name: refundCase.createdBy.name }
            : null,
          assignedTo: refundCase.assignedTo
            ? { id: refundCase.assignedTo.id, name: refundCase.assignedTo.name }
            : null,
          approvedBy: refundCase.approvedBy
            ? { id: refundCase.approvedBy.id, name: refundCase.approvedBy.name }
            : null,
          approvedAt: refundCase.approvedAt?.toISOString() ?? null,
        }}
        components={refundCase.components.map((c) => ({
          id: c.id,
          paymentMethodKey: c.paymentMethod.key,
          paymentMethodLabel: c.paymentMethod.label,
          amount: c.amount,
          currency: c.currency,
          authCode: c.authCode,
          arn: c.arn,
          status: c.status,
        }))}
        notes={refundCase.notes.map((n) => ({
          id: n.id,
          body: n.body,
          authorName: n.author.name,
          authorId: n.author.id,
          createdAt: n.createdAt.toISOString(),
          mentionNames: n.mentions.map((m) => m.user.name),
        }))}
        activity={refundCase.activityLogs.map((a) => ({
          id: a.id,
          kind: a.kind,
          message: a.message,
          actorLabel: a.actorLabel,
          createdAt: a.createdAt.toISOString(),
        }))}
        mentionableUsers={mentionableUsers}
        currentUserId={session?.user?.id ?? ''}
        canApprove={canApprove}
        isDeleted={isDeleted}
      />
    </div>
  );
}
