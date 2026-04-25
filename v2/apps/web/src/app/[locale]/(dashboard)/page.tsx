import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default async function DashboardHome() {
  const session = await auth();
  const t = await getTranslations('dashboard');

  // Stats for the dashboard
  const [totalCases, pendingCases, completedCases, pendingApprovals] = await Promise.all([
    prisma.refundCase.count({ where: { deletedAt: null } }),
    prisma.refundCase.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
    prisma.refundCase.count({ where: { deletedAt: null, status: 'REFUNDED' } }),
    prisma.user.count({ where: { status: 'PENDING' } }),
  ]);

  const stats = [
    { label: 'Total cases', value: totalCases, icon: FileText, tint: 'text-primary' },
    { label: 'Pending approval', value: pendingCases, icon: Clock, tint: 'text-warning' },
    { label: 'Completed', value: completedCases, icon: CheckCircle2, tint: 'text-success' },
    { label: 'User approvals', value: pendingApprovals, icon: AlertCircle, tint: 'text-destructive' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-display-md font-normal tracking-tight text-heading">
          {t('welcome', { name: session?.user.name ?? '' })}
        </h1>
        <p className="mt-2 text-body">Here's what's happening across the platform today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-body">{stat.label}</CardTitle>
                <Icon className={`h-5 w-5 ${stat.tint}`} />
              </CardHeader>
              <CardContent>
                <div className="text-display-md font-light tabular">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('recentActivity')}</CardTitle>
            <CardDescription>Latest cases across all countries</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No cases yet. Create your first case from the Cases tab.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Phase 1 scaffolding</CardTitle>
              <Badge variant="success">Active</Badge>
            </div>
            <CardDescription>Foundation complete — ready for Phase 2 domain features.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Auth.js with admin approval</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> i18n (AR + EN) with RTL</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Design system (Stripe tokens)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Prisma schema (40+ tables)</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Power Automate dispatcher (stub)</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
