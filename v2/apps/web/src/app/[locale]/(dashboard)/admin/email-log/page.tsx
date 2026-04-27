import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { ResendEmailButton } from './resend-button';
import { BulkResendFailedButton } from './bulk-resend-button';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}

const PAGE_SIZE = 50;

export default async function EmailLogPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const { q, status, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);

  const where = {
    ...(q ? { OR: [{ to: { contains: q } }, { subject: { contains: q } }] } : {}),
    ...(status ? { status } : {}),
  };

  const [entries, total, failedCount] = await Promise.all([
    prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.emailLog.count({ where }),
    prisma.emailLog.count({
      where: {
        status: 'FAILED',
        ...(q ? { OR: [{ to: { contains: q } }, { subject: { contains: q } }] } : {}),
      },
    }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statusVariant = (s: string): 'success' | 'destructive' | 'secondary' =>
    s === 'SENT' ? 'success' : s === 'BOUNCED' || s === 'FAILED' ? 'destructive' : 'secondary';

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Email Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Outbound emails dispatched by the system, with delivery status from the Power Automate webhook.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>{total} email{total === 1 ? '' : 's'} · page {pageNum} of {pages}</CardTitle>
              <CardDescription>
                Search by recipient or subject.
                {failedCount > 0 ? (
                  <>
                    {' '}<span className="text-destructive font-medium">{failedCount} failed</span> matching this filter.
                  </>
                ) : null}
              </CardDescription>
            </div>
            <div className="flex items-end gap-2">
              <BulkResendFailedButton failedCount={failedCount} q={q ?? ''} />
            </div>
            <form className="flex gap-2" method="get">
              <input
                name="q"
                defaultValue={q ?? ''}
                placeholder="email or subject…"
                className="w-56 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
              <select
                name="status"
                defaultValue={status ?? ''}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Any status</option>
                <option value="QUEUED">Queued</option>
                <option value="SENT">Sent</option>
                <option value="DELIVERED">Delivered</option>
                <option value="BOUNCED">Bounced</option>
                <option value="FAILED">Failed</option>
              </select>
              <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Filter
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Status</th>
                <th className="p-3">Template</th>
                <th className="p-3">To</th>
                <th className="p-3">Subject</th>
                <th className="p-3 text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">No emails sent yet.</td>
                </tr>
              ) : entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                  <td className="p-3"><Badge variant={statusVariant(e.status)}>{e.status}</Badge></td>
                  <td className="p-3 font-mono text-xs">{e.templateKey ?? '—'}</td>
                  <td className="p-3 text-xs">{e.to}</td>
                  <td className="p-3 max-w-xs truncate">{e.subject}</td>
                  <td className="p-3 text-end">
                    {e.status === 'FAILED' ? <ResendEmailButton logId={e.id} /> : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
