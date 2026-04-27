import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { AutomationRulesManager, type RuleRow } from './manager';

export const dynamic = 'force-dynamic';

export default async function AutomationRulesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const rules = await prisma.automationRule.findMany({
    orderBy: [{ isActive: 'desc' }, { scope: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
  });

  const rows: RuleRow[] = rules.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    scope: r.scope,
    conditions: r.conditions,
    actions: r.actions,
    priority: r.priority,
    isActive: r.isActive,
    updatedAt: formatDateTime(r.updatedAt),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-heading">Automation rules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            IF/THEN rules that fire on case, promo, and batch events. Conditions and
            actions are stored as JSON — the runtime evaluator reads them when
            entities change state.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {rows.filter((r) => r.isActive).length} active · {rows.length} total
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rules</CardTitle>
          <CardDescription>
            Higher priority rules evaluate first. Inactive rules are persisted but
            ignored at runtime.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AutomationRulesManager rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
