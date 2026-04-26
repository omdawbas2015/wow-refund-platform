'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { CopyButton } from '@/components/ui/copy-button';
import type { CaseStatus } from '@/components/ui/case-status-stepper';
import { PaymentMethodIcons } from '@/components/ui/payment-method-icons';
import { formatDate, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { ArrowUpRight, Trash2 } from 'lucide-react';

export type CaseRow = {
  id: string;
  caseNumber: string;
  status: CaseStatus;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  brandName: string;
  branchName: string | null;
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

/**
 * Cases table redesign — Linear/Stripe-style data density:
 *   - Country and brand split into two cells; flag carries country alone,
 *     brand owns its column with branch as a muted subtitle.
 *   - Amount cell uses a leading muted currency code so the eye lines up
 *     on the digit, not the symbol; partial refunds add a tiny progress
 *     bar instead of a second money line.
 *   - Customer keeps name + email but with a tighter type ramp.
 *   - Headers are sentence case + medium weight; row hover is a faint
 *     primary tint, with a trailing ↗ that fades in on hover.
 */
export function CasesTable({
  locale,
  cases,
}: {
  locale: string;
  cases: CaseRow[];
}) {
  const router = useRouter();

  const openCase = (id: string) => router.push(`/${locale}/cases/${id}`);

  return (
    <>
      {/* Desktop — clean data table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/40">
              <Th>Case</Th>
              <Th>Customer</Th>
              <Th>Country</Th>
              <Th>Brand</Th>
              <Th align="end">Refund</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th>Created</Th>
              <th className="w-8 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {cases.map((c) => (
              <tr
                key={c.id}
                onClick={() => openCase(c.id)}
                className={cn(
                  'group cursor-pointer transition-colors hover:bg-primary/[0.03]',
                  c.isDeleted && 'opacity-50',
                )}
              >
                <td className="whitespace-nowrap px-4 py-3.5">
                  <div className="inline-flex items-center gap-1">
                    <Link
                      href={`/${locale}/cases/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'font-mono text-xs font-semibold tracking-tight',
                        c.isDeleted
                          ? 'text-muted-foreground line-through'
                          : 'text-primary hover:underline',
                      )}
                    >
                      {c.caseNumber}
                    </Link>
                    <span className="opacity-0 transition-opacity group-hover:opacity-100">
                      <CopyButton
                        value={c.caseNumber}
                        size="xs"
                        label="Copy case number"
                      />
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="max-w-[220px] truncate text-sm font-medium text-heading">
                    {c.customerName}
                  </div>
                  <div className="group/email mt-0.5 inline-flex max-w-[220px] items-center gap-1 text-xs text-muted-foreground">
                    <span className="truncate">{c.customerEmail}</span>
                    <span className="shrink-0 opacity-0 transition-opacity group-hover/email:opacity-100">
                      <CopyButton
                        value={c.customerEmail}
                        size="xs"
                        label="Copy email"
                      />
                    </span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <div className="inline-flex items-center gap-2">
                    <span className="text-base leading-none" aria-hidden>
                      {c.countryFlag || '\uD83C\uDF10'}
                    </span>
                    <span className="text-sm text-heading">{c.countryName}</span>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  <div className="text-sm font-medium text-heading">
                    {c.brandName}
                  </div>
                  {c.branchName && (
                    <div className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">
                      {c.branchName}
                    </div>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-end">
                  <AmountCell
                    refund={c.totalRefundAmount}
                    currency={c.orderCurrency}
                  />
                </td>
                <td className="px-4 py-3.5">
                  <PaymentMethodIcons methods={c.paymentMethods} size="sm" />
                </td>
                <td className="whitespace-nowrap px-4 py-3.5">
                  {c.isDeleted ? (
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-zinc-500/10 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      <Trash2 className="h-3 w-3" />
                      Deleted
                    </span>
                  ) : (
                    <CaseStatusBadge status={c.status} />
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3.5 text-xs text-muted-foreground">
                  {formatDate(new Date(c.createdAt))}
                </td>
                <td className="px-2 py-3.5">
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile — card list */}
      <ul className="divide-y divide-border md:hidden">
        {cases.map((c) => (
          <li key={c.id} className={cn(c.isDeleted && 'opacity-50')}>
            <Link
              href={`/${locale}/cases/${c.id}`}
              className="block px-4 py-3.5 transition-colors hover:bg-surface-subtle/50"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span
                  className={cn(
                    'font-mono text-xs font-semibold',
                    c.isDeleted ? 'text-muted-foreground line-through' : 'text-primary',
                  )}
                >
                  {c.caseNumber}
                </span>
                {c.isDeleted ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/10 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                    <Trash2 className="h-3 w-3" />
                    Deleted
                  </span>
                ) : (
                  <CaseStatusBadge status={c.status} />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-heading">{c.customerName}</div>
                <div className="truncate text-xs text-muted-foreground">
                  <span aria-hidden>{c.countryFlag}</span> {c.countryName} ·{' '}
                  {c.brandName}
                  {c.branchName ? ` · ${c.branchName}` : ''}
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <PaymentMethodIcons methods={c.paymentMethods} size="sm" />
                <AmountCell
                  refund={c.totalRefundAmount}
                  currency={c.orderCurrency}
                />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

function Th({
  children,
  align = 'start',
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
}) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-4 py-2.5 text-xs font-medium text-muted-foreground',
        align === 'end' ? 'text-end' : 'text-start',
      )}
    >
      {children}
    </th>
  );
}

/**
 * Amount cell — single tabular-nums money line so digits align across rows.
 * Partial refunds are signalled by the `Partially refunded` status pill in
 * the next column; we don't need a second visual cue here.
 */
function AmountCell({
  refund,
  currency,
}: {
  refund: number;
  currency: string;
}) {
  return (
    <span className="font-mono text-sm font-semibold tabular-nums text-heading">
      {formatMoney(refund, currency)}
    </span>
  );
}
