import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getModuleToggleStatuses } from '@/lib/module-toggles';
import { ModuleToggleRow } from './row';

export const dynamic = 'force-dynamic';

export default async function ModulesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const modules = await getModuleToggleStatuses();
  const enabledCount = modules.filter((m) => m.isEnabled).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-heading">Modules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Globally enable or disable optional modules. Disabled modules are
            hidden from the sidebar; their routes return a redirect home.
            Core areas (cases, operations, admin basics) are not toggleable.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {enabledCount} enabled · {modules.length} total
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available modules</CardTitle>
          <CardDescription>
            Toggling a module writes an audit-log entry and revalidates this page.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {modules.map((m) => (
              <ModuleToggleRow key={m.key} module={m} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
