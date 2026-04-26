import { prisma } from '@wow/db';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/auth';
import { formatDate, formatDateTime } from '@/lib/utils';
import { Link } from '@/i18n/routing';
import { AuraBatchActions } from './actions';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

interface CaseSnapshotItem {
  caseId: string;
  caseNumber: string;
  customerName: string;
  customerEmail: string;
  auraPoints: number;
  brandSlug: string;
  countryCode: string;
}

export default async function AuraBatchDetailPage({ params }: PageProps) {
  const { id, locale } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD') redirect('/operations');
  const localeFmt = locale === 'ar' ? 'ar-KW' : 'en-US';

  const batch = await prisma.auraBatch.findUnique({ where: { id } });
  if (!batch) notFound();

  const snapshot: CaseSnapshotItem[] = batch.caseSnapshot
    ? (JSON.parse(batch.caseSnapshot) as CaseSnapshotItem[])
    : [];
  const totalPoints = snapshot.reduce((s, c) => s + c.auraPoints, 0);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/operations" className="text-xs uppercase text-muted-foreground hover:text-primary">
            ← Operations
          </Link>
          <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">
            {batch.batchNumber}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{batch.status}</Badge>
            <span>· created {formatDate(batch.createdAt, localeFmt)}</span>
            {batch.sentAt ? <span>· sent {formatDateTime(batch.sentAt, localeFmt)}</span> : null}
            {batch.completedAt ? (
              <span>· completed {formatDateTime(batch.completedAt, localeFmt)}</span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total cases" value={batch.totalCases} />
        <Stat
          label="Confirmed"
          value={`${batch.completedCases}/${batch.totalCases}`}
        />
        <Stat label="Total points" value={totalPoints} />
        <Stat
          label="Scheduled for"
          value={formatDate(batch.scheduledFor, localeFmt)}
        />
      </div>

      <div className="mb-6">
        <AuraBatchActions
          batchId={batch.id}
          status={batch.status}
          recipientEmails={batch.recipientEmails}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cases in batch</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                  <th>Country</th>
                  <th>Case</th>
                  <th>Customer</th>
                  <th>Brand</th>
                  <th className="text-end">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {snapshot.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No cases captured in snapshot.
                    </td>
                  </tr>
                ) : (
                  snapshot.map((c) => (
                    <tr key={c.caseId} className="hover:bg-surface-subtle">
                      <td className="px-4 py-2 tabular">{c.countryCode}</td>
                      <td className="px-4 py-2 font-medium">
                        <Link href={`/cases/${c.caseId}`} className="hover:text-primary">
                          {c.caseNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        <div>{c.customerName}</div>
                        <div className="text-xs text-muted-foreground">{c.customerEmail}</div>
                      </td>
                      <td className="px-4 py-2 tabular">{c.brandSlug}</td>
                      <td className="px-4 py-2 text-end tabular">{c.auraPoints}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {batch.responseRawBody ? (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Aura team response</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-xs text-foreground">{batch.responseRawBody}</pre>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function Stat(props: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-xs uppercase text-muted-foreground">{props.label}</div>
        <div className="mt-1 text-display-sm font-normal tabular">{props.value}</div>
      </CardContent>
    </Card>
  );
}
