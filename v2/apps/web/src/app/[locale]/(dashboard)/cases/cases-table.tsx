'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandAvatar } from '@/components/ui/brand-avatar';
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
 * Row click navigates straight to the case detail page. We dropped the
 * side-drawer preview — it duplicated work and slowed down the common
 * "open, act, go back" flow. Case # and email expose copy buttons on
 * hover so ops can grab identifiers without opening the case.
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
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/70">
              <Th>Case</Th>
              <Th>Customer</Th>
              <Th>Country · Brand</Th>
              <Th align="end">Amount</Th>
              <Th>Payment</Th>
              <Th>Status</Th>
              <Th>Date</Th>
              <th className="w-8 px-2 py-2.5" />
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
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="inline-flex items-center gap-1">
                    <Link
                      href={`/${locale}/cases/${c.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className={cn(
                        'font-mono text-xs font-semibold',
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
                <td className="px-4 py-3">
                  <div className="max-w-[220px] truncate font-medium text-heading">
                    {c.customerName}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <BrandAvatar name={c.brandName} />
                    <div className="min-w-0 leading-tight">
                      <div className="flex items-center gap-1.5 text-sm text-heading">
                        <span className="text-base leading-none">
                          {c.countryFlag || '\uD83C\uDF10'}
                        </span>
                        <span>{c.countryName}</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.brandName}
                        {c.branchName ? ` · ${c.branchName}` : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-end">
                  <AmountCell
                    refund={c.totalRefundAmount}
                    order={c.orderAmount}
                    currency={c.orderCurrency}
                    isPartial={c.isPartial}
                  />
                </td>
                <td className="px-4 py-3">
                  <PaymentMethodIcons methods={c.paymentMethods} size="sm" />
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
                <td className="px-2 py-3">
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
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    <Trash2 className="h-3 w-3" />
                    Deleted
                  </span>
                ) : (
                  <CaseStatusBadge status={c.status} />
                )}
              </div>
              <div className="flex items-center gap-2">
                <BrandAvatar name={c.brandName} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-heading">{c.customerName}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    <span>{c.countryFlag}</span> {c.countryName} · {c.brandName}
                    {c.branchName ? ` · ${c.branchName}` : ''}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <PaymentMethodIcons methods={c.paymentMethods} size="sm" />
                <AmountCell
                  refund={c.totalRefundAmount}
                  order={c.orderAmount}
                  currency={c.orderCurrency}
                  isPartial={c.isPartial}
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
        'whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
        align === 'end' ? 'text-end' : 'text-start',
      )}
    >
      {children}
    </th>
  );
}

/**
 * Refund number is the primary figure. A subtle typographic weight shift
 * (amber text for partial refunds, heading color for full) carries the
 * distinction — no extra colored icon, which felt noisy. The order total
 * still appears underneath as an "of X" qualifier when it's a partial.
 */
function AmountCell({
  refund,
  order,
  currency,
  isPartial,
}: {
  refund: number;
  order: number;
  currency: string;
  isPartial: boolean;
}) {
  return (
    <div className="leading-tight">
      <div
        className={cn(
          'font-mono text-sm font-semibold',
          isPartial ? 'text-amber-700 dark:text-amber-400' : 'text-heading',
        )}
      >
        {formatMoney(refund, currency)}
      </div>
      {isPartial && (
        <div className="mt-0.5 text-[10px] text-muted-foreground">
          of {formatMoney(order, currency)}
        </div>
      )}
    </div>
  );
}
