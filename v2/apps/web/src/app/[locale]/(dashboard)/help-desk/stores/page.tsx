import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { SendStoreMessageForm } from './form';

export default async function StoresHelpDeskPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const [templates, recent] = await Promise.all([
    prisma.storeMessageTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
      select: { id: true, key: true, label: true, labelAr: true },
    }),
    prisma.storeMessageLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 25,
      include: {
        template: { select: { label: true, key: true } },
        sentBy: { select: { name: true, email: true } },
      },
    }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">
          Stores communication
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Send a templated message to a store about a specific case. Stores never see the case
          itself — only the rendered subject + body.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New message</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No active templates. Ask an admin to set them up under Admin → Store templates.
            </p>
          ) : (
            <SendStoreMessageForm templates={templates} />
          )}
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent messages</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">
              No messages sent yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                  <th>Sent</th>
                  <th>Status</th>
                  <th>Case #</th>
                  <th>Store</th>
                  <th>Template</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-subtle">
                    <td className="px-4 py-2 text-xs tabular">
                      {formatDateTime(m.sentAt, 'en-US')}
                    </td>
                    <td className="px-4 py-2">
                      <Badge
                        variant={
                          m.deliveryStatus === 'SENT'
                            ? 'success'
                            : m.deliveryStatus === 'FAILED'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {m.deliveryStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{m.caseNumber}</td>
                    <td className="px-4 py-2 text-xs">{m.storeEmail}</td>
                    <td className="px-4 py-2 text-xs">{m.template.label}</td>
                    <td className="px-4 py-2 text-xs">{m.sentBy.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
