'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatMoney } from '@/lib/format';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';

type HistoryPriorCase = {
  id: string;
  caseNumber: string;
  status: string;
  createdAt: string;
  totalRefundAmount: number;
  orderCurrency: string;
};

type HistoryPromo = {
  id: string;
  code: string | null;
  type: string;
  amount: number | null;
  currency: string | null;
  createdAt: string;
};

export function CustomerHistory({
  locale,
  customerEmail,
  excludeCaseId,
}: {
  locale: string;
  customerEmail: string;
  excludeCaseId: string;
}) {
  const [data, setData] = useState<{
    priorCases: HistoryPriorCase[];
    promos: HistoryPromo[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/customer-history?email=${encodeURIComponent(customerEmail)}&excludeCaseId=${excludeCaseId}`,
    )
      .then((r) => (r.ok ? r.json() : { priorCases: [], promos: [] }))
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData({ priorCases: [], promos: [] });
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [customerEmail, excludeCaseId]);

  return (
    <div className="rounded-md border border-border bg-surface">
      <div className="border-b border-border px-4 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Customer history
      </div>
      <div className="p-3 space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Prior cases</span>
            {data && (
              <Badge variant="outline" className="text-[10px]">
                {data.priorCases.length}
              </Badge>
            )}
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : data?.priorCases.length === 0 ? (
            <div className="text-xs text-muted-foreground">No other cases for this customer.</div>
          ) : (
            <ul className="space-y-1.5">
              {data?.priorCases.slice(0, 5).map((pc) => (
                <li key={pc.id} className="flex items-center justify-between gap-2 text-xs">
                  <Link
                    href={`/${locale}/cases/${pc.id}`}
                    className="font-mono font-medium text-primary hover:underline"
                  >
                    {pc.caseNumber}
                  </Link>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">
                      {formatMoney(pc.totalRefundAmount, pc.orderCurrency)}
                    </span>
                    <CaseStatusBadge status={pc.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Promos sent</span>
            {data && (
              <Badge variant="outline" className="text-[10px]">
                {data.promos.length}
              </Badge>
            )}
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : data?.promos.length === 0 ? (
            <div className="text-xs text-muted-foreground">No promos sent to this customer.</div>
          ) : (
            <ul className="space-y-1.5">
              {data?.promos.slice(0, 5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    {p.code ? (
                      <span className="font-mono text-foreground">{p.code}</span>
                    ) : (
                      <span className="text-muted-foreground">No code</span>
                    )}
                    <span className="ms-1 text-muted-foreground">{p.type}</span>
                  </span>
                  <span className="text-muted-foreground">{formatDate(p.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
