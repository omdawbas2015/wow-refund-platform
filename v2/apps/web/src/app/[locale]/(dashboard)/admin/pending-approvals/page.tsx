import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDateTime } from '@/lib/utils';
import { ApprovalRow } from './approval-row';

export default async function PendingApprovalsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const { locale } = await params;
  const t = await getTranslations('admin.pendingApprovals');

  const [pending, roles, countries] = await Promise.all([
    prisma.user.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.role.findMany({ where: { key: { not: 'ADMIN' } }, orderBy: { name: 'asc' } }),
    prisma.country.findMany({
      where: { isActive: true },
      include: { registry: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">{t('title')}</h1>
        <p className="mt-2 text-body">{t('subtitle')}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {pending.length} pending request{pending.length === 1 ? '' : 's'}
          </CardTitle>
          <CardDescription>
            Approved users will receive an email with a link to set their password.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {pending.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">{t('empty')}</div>
          ) : (
            <div className="divide-y divide-border">
              {pending.map((user) => (
                <ApprovalRow
                  key={user.id}
                  user={{
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    createdAtLabel: formatDateTime(user.createdAt, locale === 'ar' ? 'ar-SA' : 'en-US'),
                  }}
                  roles={roles.map((r) => ({ id: r.id, label: locale === 'ar' ? r.nameAr ?? r.name : r.name }))}
                  countries={countries.map((c) => ({
                    id: c.id,
                    label: locale === 'ar' ? c.registry.nameAr : c.registry.nameEn,
                    flag: c.registry.flag,
                  }))}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
