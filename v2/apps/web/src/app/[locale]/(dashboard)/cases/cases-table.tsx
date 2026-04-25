'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { deleteCaseAction, updateCaseStatusAction } from '@/app/actions/cases';
import { Button } from '@/components/ui/button';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import {
  CaseStatusStepper,
  type CaseStatus,
} from '@/components/ui/case-status-stepper';
import { PaymentMethodIcons } from '@/components/ui/payment-method-icons';
import { formatDate, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  ArrowUpRight,
  CheckCircle2,
  ExternalLink,
  Send,
  Trash2,
  X,
} from 'lucide-react';

export type CaseRow = {
  id: string;
  caseNumber: string;
  status: CaseStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  brandName: string;
  countryName: string;
  countryFlag: string;
  orderNumber: string;
  orderDate: string;
  orderAmount: number;
  orderCurrency: string;
  totalRefundAmount: number;
  isPartial: boolean;
  createdAt: string;
  createdByName: string | null;
  rootCause: string | null;
  isDeleted: boolean;
  paymentMethods: { key: string; label: string }[];
};

export function CasesTable({
  locale,
  cases,
  canApprove,
}: {
  locale: string;
  cases: CaseRow[];
  canApprove: boolean;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openCase = cases.find((c) => c.id === openId) ?? null;

  // Close on escape
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [openId]);

  return (
    <>
      {/* Desktop / tablet — horizontally scrollable table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-surface-subtle text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-start font-medium">Case #</th>
              <th className="whitespace-nowrap px-4 py-3 text-start font-medium">Customer</th>
              <th className="whitespace-nowrap px-4 py-3 text-start font-medium">Brand · Country</th>
              <th className="whitespace-nowrap px-4 py-3 text-start font-medium">Order</th>
              <th className="whitespace-nowrap px-4 py-3 text-end font-medium">Refund</th>
              <th className="whitespace-nowrap px-4 py-3 text-start font-medium">Payment</th>
              <th className="whitespace-nowrap px-4 py-3 text-start font-medium">Status</th>
              <th className="whitespace-nowrap px-4 py-3 text-start font-medium">Created</th>
              <th className="w-10 px-2 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.map((c) => (
              <tr
                key={c.id}
                onClick={() => setOpenId(c.id)}
                className={cn(
                  'cursor-pointer transition-colors hover:bg-surface-subtle/50',
                  openId === c.id && 'bg-primary/5',
                  c.isDeleted && 'opacity-60',
                )}
              >
                <td className="whitespace-nowrap px-4 py-3">
                  <span
                    className={cn(
                      'font-mono text-sm font-medium',
                      c.isDeleted ? 'text-muted-foreground line-through' : 'text-primary',
                    )}
                  >
                    {c.caseNumber}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">{c.customerName}</div>
                  <div className="text-xs text-muted-foreground">{c.customerEmail}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg leading-none">{c.countryFlag || '🌐'}</span>
                    <div>
                      <div className="text-sm font-medium">{c.brandName}</div>
                      <div className="text-xs text-muted-foreground">{c.countryName}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="font-mono text-xs">{c.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(new Date(c.orderDate))}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-end font-mono">
                  {formatMoney(c.totalRefundAmount, c.orderCurrency)}
                  {c.isPartial && (
                    <div className="text-xs font-normal text-muted-foreground">
                      of {formatMoney(c.orderAmount, c.orderCurrency)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <PaymentMethodIcons methods={c.paymentMethods} />
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {c.isDeleted ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      <Trash2 className="h-3 w-3" />
                      Deleted
                    </span>
                  ) : (
                    <CaseStatusBadge status={c.status} />
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {formatDate(new Date(c.createdAt))}
                </td>
                <td className="px-2 py-3 text-muted-foreground">
                  <ArrowUpRight className="h-4 w-4" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — stacked card list */}
      <ul className="divide-y divide-border md:hidden">
        {cases.map((c) => (
          <li
            key={c.id}
            onClick={() => setOpenId(c.id)}
            className={cn(
              'cursor-pointer px-4 py-3 transition-colors hover:bg-surface-subtle/50',
              c.isDeleted && 'opacity-60',
            )}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span
                className={cn(
                  'font-mono text-xs font-semibold',
                  c.isDeleted ? 'text-muted-foreground line-through' : 'text-primary',
                )}
              >
                {c.caseNumber}
              </span>
              {c.isDeleted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Trash2 className="h-3 w-3" />
                  Deleted
                </span>
              ) : (
                <CaseStatusBadge status={c.status} />
              )}
            </div>
            <div className="text-sm font-medium">{c.customerName}</div>
            <div className="mb-2 text-xs text-muted-foreground">{c.customerEmail}</div>
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span className="text-base leading-none">{c.countryFlag || '🌐'}</span>
                <span className="text-foreground">{c.brandName}</span>
                <span>· {c.countryName}</span>
              </span>
              <span className="font-mono">{c.orderNumber}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <PaymentMethodIcons methods={c.paymentMethods} />
              <span className="font-mono text-sm font-semibold">
                {formatMoney(c.totalRefundAmount, c.orderCurrency)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {openCase && (
        <CaseQuickDrawer
          caseRow={openCase}
          locale={locale}
          canApprove={canApprove}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

function CaseQuickDrawer({
  caseRow,
  locale,
  canApprove: canUserApprove,
  onClose,
}: {
  caseRow: CaseRow;
  locale: string;
  canApprove: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function transitionStatus(target: string, reason?: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateCaseStatusAction({
        caseId: caseRow.id,
        target,
        reason,
      });
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  function deleteCase() {
    const reason = window.prompt('Reason for deleting this case?');
    if (!reason || reason.trim().length < 3) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteCaseAction({ caseId: caseRow.id, reason: reason.trim() });
      if (result.ok) {
        router.refresh();
        onClose();
      } else {
        setError(result.error);
      }
    });
  }

  const isDeleted = caseRow.isDeleted;
  const canSubmit = !isDeleted && caseRow.status === 'DRAFT';
  const isPendingApproval = !isDeleted && caseRow.status === 'PENDING_APPROVAL';
  const canStartExecution = !isDeleted && caseRow.status === 'APPROVED';
  const canMarkRefunded =
    !isDeleted &&
    (caseRow.status === 'IN_EXECUTION' || caseRow.status === 'PARTIALLY_REFUNDED');
  const canDelete =
    !isDeleted &&
    caseRow.status !== 'REFUNDED' &&
    caseRow.status !== 'PARTIALLY_REFUNDED' &&
    caseRow.status !== 'REJECTED' &&
    caseRow.status !== 'CANCELLED';

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel — slides from inline-end (right in LTR, left in RTL) */}
      <div
        className={cn(
          'absolute inset-y-0 end-0 flex w-full max-w-[480px] flex-col',
          'bg-surface shadow-xl border-s border-border',
          'animate-in slide-in-from-end duration-200',
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'font-mono text-sm font-semibold',
                  isDeleted ? 'text-muted-foreground line-through' : 'text-primary',
                )}
              >
                {caseRow.caseNumber}
              </span>
              {isDeleted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Trash2 className="h-3 w-3" />
                  Deleted
                </span>
              ) : (
                <CaseStatusBadge status={caseRow.status} />
              )}
            </div>
            <div className="mt-1 truncate text-sm text-muted-foreground">
              {caseRow.customerName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-surface-subtle hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Stepper */}
          <div className="mb-5">
            <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Progress
            </div>
            <CaseStatusStepper
              status={caseRow.status}
              locale={locale}
              deleted={isDeleted}
            />
          </div>

          {/* Overview grid — payment sits inline here with order info so it
              reads like an invoice line, not a separate header block. */}
          <div className="mb-5 grid grid-cols-2 gap-4 text-sm">
            <InfoRow label="Brand">
              <span className="me-1.5 text-base leading-none">{caseRow.countryFlag || '🌐'}</span>
              {caseRow.brandName}
            </InfoRow>
            <InfoRow label="Country">{caseRow.countryName}</InfoRow>
            <InfoRow label="Order #">
              <span className="font-mono">{caseRow.orderNumber}</span>
            </InfoRow>
            <InfoRow label="Order date">
              {formatDate(new Date(caseRow.orderDate))}
            </InfoRow>
            <InfoRow label="Order amount">
              <span className="font-mono">
                {formatMoney(caseRow.orderAmount, caseRow.orderCurrency)}
              </span>
            </InfoRow>
            <InfoRow label="Refund amount">
              <span className="font-mono font-semibold text-heading">
                {formatMoney(caseRow.totalRefundAmount, caseRow.orderCurrency)}
              </span>
              {caseRow.isPartial && (
                <span className="ms-1.5 rounded-full border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  Partial
                </span>
              )}
            </InfoRow>
            {caseRow.paymentMethods.length > 0 && (
              <InfoRow label="Payment" wide>
                <PaymentMethodIcons methods={caseRow.paymentMethods} size="sm" />
              </InfoRow>
            )}
            <InfoRow label="Customer email" wide>
              <span className="break-all">{caseRow.customerEmail}</span>
            </InfoRow>
            {caseRow.customerPhone && (
              <InfoRow label="Customer phone" wide>
                {caseRow.customerPhone}
              </InfoRow>
            )}
            {caseRow.rootCause && (
              <InfoRow label="Root cause" wide>
                {caseRow.rootCause}
              </InfoRow>
            )}
            <InfoRow label="Created">
              {formatDate(new Date(caseRow.createdAt))}
            </InfoRow>
            {caseRow.createdByName && (
              <InfoRow label="Created by">{caseRow.createdByName}</InfoRow>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Footer / Actions */}
        <div className="border-t border-border px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
            {canSubmit && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => transitionStatus('PENDING_APPROVAL')}
              >
                <Send className="h-4 w-4" />
                Submit for approval
              </Button>
            )}
            {isPendingApproval && canUserApprove && (
              <Button
                size="sm"
                variant="success"
                disabled={isPending}
                onClick={() => transitionStatus('APPROVED')}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            )}
            {isPendingApproval && !canUserApprove && (
              <span className="rounded-md bg-surface-subtle/60 px-2.5 py-1.5 text-xs text-muted-foreground">
                Waiting for country manager approval
              </span>
            )}
            {canStartExecution && (
              <Button
                size="sm"
                disabled={isPending}
                onClick={() => transitionStatus('IN_EXECUTION')}
              >
                Start execution
              </Button>
            )}
            {canMarkRefunded && (
              <Button
                size="sm"
                variant="success"
                disabled={isPending}
                onClick={() => transitionStatus('REFUNDED')}
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark refunded
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={deleteCase}
                className="text-destructive hover:bg-destructive/5 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
            <div className="ms-auto">
              <Button asChild size="sm" variant="outline">
                <Link href={`/${locale}/cases/${caseRow.id}`}>
                  Open case
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn('flex flex-col gap-0.5', wide && 'col-span-2')}>
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-heading">{children}</span>
    </div>
  );
}
