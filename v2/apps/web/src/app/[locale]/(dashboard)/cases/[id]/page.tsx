import { notFound } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import {
  caseStatusVariant,
  caseStatusLabel,
  componentStatusVariant,
  componentStatusLabel,
  auraStatusLabel,
} from '@/lib/cases/case-status-display';
import { CaseActions } from './case-actions';
import { ComponentsTable } from './components-table';
import { NotesSection } from './notes-section';
import { CaseTimeline } from './case-timeline';

export default async function CaseDetailsPage(props: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await props.params;
  const session = await auth();
  if (!session?.user) return null;
  const me = session.user;
  const localeFmt = me.preferredLocale === 'ar' ? 'ar-KW' : 'en-US';

  const refundCase = await prisma.refundCase.findUnique({
    where: { id },
    include: {
      country: { select: { registryCode: true, registry: { select: { nameEn: true } } } },
      brand: { select: { name: true } },
      branch: { select: { name: true } },
      rootCause: { select: { label: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      components: {
        orderBy: { createdAt: 'asc' },
        include: {
          paymentMethod: { select: { key: true, label: true, requiresAuthCode: true } },
          refundedBy: { select: { name: true, email: true } },
        },
      },
      notes: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: {
          author: { select: { id: true, name: true, email: true } },
          mentions: { include: { user: { select: { id: true, name: true } } } },
        },
      },
    },
  });

  if (!refundCase || refundCase.deletedAt) notFound();

  const teammates = await prisma.user.findMany({
    where: { status: 'ACTIVE', deletedAt: null, id: { not: me.id } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
    take: 100,
  });

  const canManage = me.role === 'ADMIN' || me.role === 'COUNTRY_MANAGER';
  const canCancel = canManage || refundCase.createdById === me.id;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase text-muted-foreground">{refundCase.country.registryCode} · {refundCase.brand.name}</div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">
            {refundCase.caseNumber}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={caseStatusVariant(refundCase.status)}>
              {caseStatusLabel(refundCase.status)}
            </Badge>
            {refundCase.isPartial ? <Badge variant="outline">Partial</Badge> : null}
            <span>·</span>
            <span>Order {refundCase.orderNumber}</span>
            <span>·</span>
            <span>{formatDate(refundCase.orderDate, localeFmt)}</span>
          </div>
        </div>
        <CaseActions
          caseId={refundCase.id}
          status={refundCase.status}
          canManage={canManage}
          canCancel={canCancel}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Components */}
          <Card>
            <CardHeader>
              <CardTitle>Refund components</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ComponentsTable
                caseStatus={refundCase.status}
                localeFmt={localeFmt}
                components={refundCase.components.map((c) => ({
                  id: c.id,
                  paymentMethodKey: c.paymentMethod.key,
                  paymentMethodLabel: c.paymentMethod.label,
                  requiresAuthCode: c.paymentMethod.requiresAuthCode,
                  amount: c.amount,
                  currency: c.currency,
                  status: c.status,
                  statusLabel: componentStatusLabel(c.status),
                  statusVariant: componentStatusVariant(c.status),
                  authCode: c.authCode,
                  last4: c.last4,
                  arn: c.arn,
                  refundedAt: c.refundedAt ? formatDateTime(c.refundedAt, localeFmt) : null,
                  refundedBy: c.refundedBy?.name ?? null,
                }))}
              />
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes &amp; activity</CardTitle>
            </CardHeader>
            <CardContent>
              <NotesSection
                caseId={refundCase.id}
                localeFmt={localeFmt}
                teammates={teammates}
                notes={refundCase.notes.map((n) => ({
                  id: n.id,
                  body: n.body,
                  authorName: n.author.name,
                  authorEmail: n.author.email,
                  createdAt: formatDateTime(n.createdAt, localeFmt),
                  mentions: n.mentions.map((m) => m.user.name),
                }))}
              />
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <CaseTimeline caseId={refundCase.id} localeFmt={localeFmt} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <div className="text-muted-foreground text-xs">Name</div>
                <div>{refundCase.customerName}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Email</div>
                <div className="break-all">{refundCase.customerEmail}</div>
              </div>
              {refundCase.customerPhone ? (
                <div>
                  <div className="text-muted-foreground text-xs">Phone</div>
                  <div>{refundCase.customerPhone}</div>
                </div>
              ) : null}
              {refundCase.customerNotes ? (
                <div>
                  <div className="text-muted-foreground text-xs">Notes</div>
                  <div className="whitespace-pre-wrap text-body">{refundCase.customerNotes}</div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Order &amp; refund</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Order amount" value={formatCurrency(refundCase.orderAmount, refundCase.orderCurrency, localeFmt, 2)} />
              <Row
                label="Total refund"
                value={formatCurrency(refundCase.totalRefundAmount, refundCase.orderCurrency, localeFmt, 2)}
              />
              {refundCase.rootCause ? <Row label="Root cause" value={refundCase.rootCause.label} /> : null}
              {refundCase.rootCauseNotes ? (
                <Row label="Notes" value={refundCase.rootCauseNotes} />
              ) : null}
              {refundCase.auraPoints && refundCase.auraPoints > 0 ? (
                <Row
                  label="Aura points"
                  value={`${refundCase.auraPoints} · ${auraStatusLabel(refundCase.auraStatus)}`}
                />
              ) : null}
              {refundCase.branch ? <Row label="Branch" value={refundCase.branch.name} /> : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>People</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Created by" value={refundCase.createdBy.name} sub={refundCase.createdBy.email} />
              {refundCase.assignedTo ? (
                <Row
                  label="Assigned to"
                  value={refundCase.assignedTo.name}
                  sub={refundCase.assignedTo.email}
                />
              ) : null}
              {refundCase.approvedBy ? (
                <Row
                  label="Approved by"
                  value={refundCase.approvedBy.name}
                  sub={
                    refundCase.approvedAt
                      ? formatDateTime(refundCase.approvedAt, localeFmt)
                      : refundCase.approvedBy.email
                  }
                />
              ) : null}
              {refundCase.rejectedReason ? (
                <Row label="Rejected reason" value={refundCase.rejectedReason} />
              ) : null}
              {refundCase.cancelledReason ? (
                <Row label="Cancelled reason" value={refundCase.cancelledReason} />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row(props: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{props.label}</div>
      <div className="break-words">{props.value}</div>
      {props.sub ? <div className="text-muted-foreground text-xs">{props.sub}</div> : null}
    </div>
  );
}
