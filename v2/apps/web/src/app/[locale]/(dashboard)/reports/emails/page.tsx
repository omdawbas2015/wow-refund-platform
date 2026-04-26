import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { ResendButton } from './resend-button';

interface PageProps {
  searchParams: Promise<{
    status?: string;
    key?: string;
    to?: string;
    from?: string;
    until?: string;
    page?: string;
  }>;
}

function parseDate(raw: string | undefined, opts?: { endOfDay?: boolean }): Date | undefined {
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

const PAGE_SIZE = 50;

export default async function EmailLogPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/reports');

  const sp = await searchParams;
  const status = sp.status ?? '';
  const key = sp.key ?? '';
  const to = sp.to ?? '';
  const from = sp.from ?? '';
  const until = sp.until ?? '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const fromDate = parseDate(from);
  const untilDate = parseDate(until, { endOfDay: true });

  const where = {
    ...(status ? { status: status as 'PENDING' | 'SENT' | 'FAILED' | 'BOUNCED' } : {}),
    ...(key ? { templateKey: key } : {}),
    ...(to ? { to: { contains: to } } : {}),
    ...(fromDate || untilDate
      ? {
          createdAt: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(untilDate ? { lte: untilDate } : {}),
          },
        }
      : {}),
  };

  const filterQs = new URLSearchParams();
  if (status) filterQs.set('status', status);
  if (key) filterQs.set('key', key);
  if (to) filterQs.set('to', to);
  if (from) filterQs.set('from', from);
  if (until) filterQs.set('until', until);

  const [logs, total, distinctKeys] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.emailLog.count({ where }),
    prisma.emailLog.findMany({
      distinct: ['templateKey'],
      select: { templateKey: true },
      orderBy: { templateKey: 'asc' },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/reports" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Reports
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">Email log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every outbound email is recorded with delivery status.
      </p>

      <form className="my-6 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          Status
          <select
            name="status"
            defaultValue={status}
            className="h-9 w-32 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Any</option>
            <option value="PENDING">Pending</option>
            <option value="SENT">Sent</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          Template
          <select
            name="key"
            defaultValue={key}
            className="h-9 w-64 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Any</option>
            {distinctKeys.map((k) => (
              <option key={k.templateKey} value={k.templateKey}>
                {k.templateKey}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          Recipient
          <input
            type="text"
            name="to"
            defaultValue={to}
            placeholder="email substring"
            className="h-9 w-56 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          From
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="h-9 w-40 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          Until
          <input
            type="date"
            name="until"
            defaultValue={until}
            className="h-9 w-40 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
        <a
          href={`/api/export/emails${filterQs.size > 0 ? `?${filterQs.toString()}` : ''}`}
          className="h-9 rounded-md border border-border bg-background px-3 text-sm font-medium leading-9 hover:bg-surface-subtle"
        >
          Export Excel
        </a>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>
            {total} entries · page {page} of {pages}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-muted-foreground">
              <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                <th>When</th>
                <th>Status</th>
                <th>Template</th>
                <th>To</th>
                <th>Subject</th>
                <th className="!text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-surface-subtle">
                  <td className="px-4 py-2 tabular text-xs">{formatDateTime(l.createdAt, 'en-US')}</td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        l.status === 'SENT'
                          ? 'success'
                          : l.status === 'FAILED'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {l.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{l.templateKey}</td>
                  <td className="px-4 py-2 text-xs">{l.to}</td>
                  <td className="px-4 py-2 max-w-md truncate text-xs">{l.subject}</td>
                  <td className="px-4 py-2 text-end">
                    {l.status === 'FAILED' ? (
                      <ResendButton logId={l.id} reason={l.failureReason} />
                    ) : null}
                  </td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No emails match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/reports/emails?${new URLSearchParams({ ...Object.fromEntries(filterQs), page: String(page - 1) }).toString()}`}
              className="rounded-md border border-border px-2 py-1 hover:bg-surface-subtle"
            >
              ← Prev
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link
              href={`/reports/emails?${new URLSearchParams({ ...Object.fromEntries(filterQs), page: String(page + 1) }).toString()}`}
              className="rounded-md border border-border px-2 py-1 hover:bg-surface-subtle"
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
