import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Link } from '@/i18n/routing';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { ArrowLeft, Mail, ShieldCheck, Activity, FileText, History } from 'lucide-react';

const RECENT_AUDIT_LIMIT = 50;
const RECENT_CASES_LIMIT = 25;
const RECENT_NOTIFICATION_LIMIT = 10;

/**
 * Admin-only user detail page.
 *
 * Shows the per-user profile metadata that already lives on /admin/users
 * plus three signal-rich panels:
 *   1. Recent activity — the last `RECENT_AUDIT_LIMIT` AuditLog rows
 *      where this user was the actor. Useful for ops leads investigating
 *      "what did X do today?" without grepping the global audit table.
 *   2. Cases assigned — the most recent open cases this user owns.
 *      Re-uses the same status badges as /cases.
 *   3. Recent notifications — last few inbox rows. Helps debug "I never
 *      got the SLA breach email" style reports.
 *
 * No mutations live here yet; that stays on /admin/users where role and
 * status changes are already audited via existing actions. This page is
 * read-only on purpose so it stays cheap to keep around.
 */
export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const { id } = await params;

  // Mirror the deletedAt filter used by /admin/users (page.tsx:15) so a
  // soft-deleted/ARCHIVED user can't be browsed via direct URL,
  // bookmark, or browser history. findUnique with a composite where is
  // fine here — `id` is unique on its own, the deletedAt clause just
  // turns this into "find by id AND not soft-deleted".
  const user = await prisma.user.findFirst({
    where: { id, deletedAt: null },
    include: {
      role: true,
      approvedBy: { select: { email: true, name: true } },
    },
  });
  if (!user) notFound();

  // primaryCountryId is a free-form FK without a back-relation in the
  // user model, so a separate lookup is the cleanest way to render the
  // country name without changing the schema.
  // Country.name lives on the CountryRegistry side, so resolve via the
  // registryCode -> registry hop. Skipping the join when the user has
  // no primary country avoids a bogus row in the panel.
  const country = user.primaryCountryId
    ? await prisma.country.findUnique({
        where: { id: user.primaryCountryId },
        select: {
          registryCode: true,
          registry: { select: { nameEn: true } },
        },
      })
    : null;

  const [recentAudits, assignedCases, recentNotifications, casesCount, auditCount] = await Promise.all([
    prisma.auditLog.findMany({
      where: { actorId: id },
      orderBy: { createdAt: 'desc' },
      take: RECENT_AUDIT_LIMIT,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        createdAt: true,
      },
    }),
    prisma.refundCase.findMany({
      where: { assignedToId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: RECENT_CASES_LIMIT,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        customerName: true,
        totalRefundAmount: true,
        orderCurrency: true,
        createdAt: true,
      },
    }),
    prisma.notification.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: RECENT_NOTIFICATION_LIMIT,
      select: {
        id: true,
        type: true,
        title: true,
        readAt: true,
        createdAt: true,
      },
    }),
    prisma.refundCase.count({ where: { assignedToId: id, deletedAt: null } }),
    prisma.auditLog.count({ where: { actorId: id } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-4">
        <Link
          href="/admin/users"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to users
        </Link>
      </div>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">
            {user.name}
          </h1>
          <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-4 w-4" />
            {user.email}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={
              user.status === 'ACTIVE'
                ? 'success'
                : user.status === 'PENDING'
                  ? 'warning'
                  : 'secondary'
            }
          >
            {user.status}
          </Badge>
          {user.role ? (
            <Badge variant="secondary" className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" />
              {user.role.name}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Profile
          </h2>
          <dl className="space-y-2 text-sm">
            <DescRow
              label="Country"
              value={
                country
                  ? `${country.registry?.nameEn ?? country.registryCode}`
                  : '—'
              }
            />
            <DescRow label="Locale" value={user.preferredLocale} />
            <DescRow label="Theme" value={user.preferredTheme} />
            <DescRow
              label="Approved by"
              value={user.approvedBy ? `${user.approvedBy.name} <${user.approvedBy.email}>` : '—'}
            />
            <DescRow label="Created" value={formatDateTime(user.createdAt)} />
            <DescRow
              label="Last login"
              value={user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '— never —'}
            />
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Workload
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Open cases" value={casesCount} icon={<FileText className="h-4 w-4" />} />
            <Stat label="Audit events" value={auditCount} icon={<History className="h-4 w-4" />} />
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-4">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <FileText className="h-4 w-4" />
          Cases assigned ({casesCount})
        </h2>
        {assignedCases.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No cases currently assigned to this user.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="py-2">Case</th>
                <th className="py-2">Customer</th>
                <th className="py-2">Amount</th>
                <th className="py-2">Status</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {assignedCases.map((c) => (
                <tr key={c.id}>
                  <td className="py-2">
                    <Link
                      href={`/cases/${c.id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {c.caseNumber}
                    </Link>
                  </td>
                  <td className="py-2 text-muted-foreground">{c.customerName}</td>
                  <td className="py-2 font-mono text-xs">
                    {c.totalRefundAmount.toFixed(3)} {c.orderCurrency}
                  </td>
                  <td className="py-2">
                    <Badge variant="secondary">{c.status}</Badge>
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">
                    {formatDateTime(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="mt-6 p-4">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <Activity className="h-4 w-4" />
          Recent activity (last {RECENT_AUDIT_LIMIT})
        </h2>
        {recentAudits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No audit log entries for this user yet.
          </p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {recentAudits.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="font-mono text-xs">{row.action}</span>
                <span className="text-xs text-muted-foreground">
                  {row.entityType ?? '—'} · {row.entityId?.slice(0, 8) ?? '—'} ·{' '}
                  {formatDateTime(row.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6 p-4">
        <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          <Mail className="h-4 w-4" />
          Recent notifications
        </h2>
        {recentNotifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {recentNotifications.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <div className="flex items-center gap-2">
                  {!n.readAt ? (
                    <span
                      className="h-2 w-2 rounded-full bg-primary"
                      aria-label="unread"
                    />
                  ) : null}
                  <span className="font-mono text-xs uppercase text-muted-foreground">
                    {n.type}
                  </span>
                  <span>{n.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(n.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function DescRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle p-3">
      <div className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-light">{value.toLocaleString()}</div>
    </div>
  );
}
