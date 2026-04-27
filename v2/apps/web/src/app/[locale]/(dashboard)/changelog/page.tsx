import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CHANGELOG_ENTRIES, type ChangelogEntry } from './entries';

export const dynamic = 'force-static';

export default async function ChangelogPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const variantFor = (t: ChangelogEntry['type']): 'success' | 'default' | 'warning' =>
    t === 'feature' ? 'success' : t === 'fix' ? 'warning' : 'default';

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Changelog</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent changes to the WOW Refund platform.
        </p>
      </div>

      {CHANGELOG_ENTRIES.map((e) => (
        <Card key={e.version}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                <span className="font-mono text-sm text-muted-foreground">{e.version}</span> · {e.title}
              </CardTitle>
              <Badge variant={variantFor(e.type)}>{e.type}</Badge>
            </div>
            <CardDescription>{e.date}</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 text-sm text-body">
              {e.details.map((d, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-muted-foreground">•</span>
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
