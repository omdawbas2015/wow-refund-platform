import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-static';

interface ChangelogEntry {
  version: string;
  date: string;
  type: 'feature' | 'improvement' | 'fix';
  title: string;
  details: string[];
}

const ENTRIES: ChangelogEntry[] = [
  {
    version: 'v0.42',
    date: '2026-04-27',
    type: 'feature',
    title: 'Reports, SLA tracking, fraud signals',
    details: [
      'New Reports area: Cases, Refunds, SLA, Agents, Countries, Audit, Emails — each with filters and Excel export.',
      'SLA engine with configurable rules per country/brand and breach/warning cron sweeps.',
      'Fraud signals admin to manage detection thresholds.',
      'Notifications inbox with mark-as-read and per-user preferences.',
      'Saved views on Cases for quick filter recall.',
      'Help Desk → Stores Communication for templated outreach.',
    ],
  },
  {
    version: 'v0.40',
    date: '2026-04-26',
    type: 'improvement',
    title: 'Promo Code UX round 3',
    details: [
      'Rebuilt allocation success popup per DESIGN.md.',
      'Recently allocated by you ribbon on the allocate page.',
      'Country-first pools board with split history view.',
      'Pool detail page with code list, fraud signal preview, and admin controls.',
    ],
  },
  {
    version: 'v0.30',
    date: '2026-04-25',
    type: 'feature',
    title: 'Refund Operations Desk',
    details: [
      'Approval Batches, KNET Batches, and Aura Batches workflows.',
      'ARN suggestions, batch picker, KNET batch detail with line-level ARN entry.',
      'Aura sidecar lifecycle: pending → in batch → completed.',
    ],
  },
  {
    version: 'v0.20',
    date: '2026-04-24',
    type: 'feature',
    title: 'Refund cases — list, detail, and state machine',
    details: [
      'Case create flow with ticket reference and component breakdown.',
      'Case detail tabs: Overview, Components, Notes, Activity.',
      'Status transitions: DRAFT → PENDING_APPROVAL → APPROVED → IN_EXECUTION → REFUNDED.',
      'Notes with @mentions and ActivityLog timeline.',
    ],
  },
  {
    version: 'v0.10',
    date: '2026-04-23',
    type: 'feature',
    title: 'Foundation',
    details: [
      'Monorepo with Next.js 15, tRPC, Prisma 6, Auth.js v5, Tailwind, next-intl.',
      'Authentication with credentials + admin approval flow.',
      'Admin panels: Users, Pending Approvals, Countries, Brands, Payment Methods.',
      'Bilingual UI (EN + AR with full RTL).',
    ],
  },
];

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

      {ENTRIES.map((e) => (
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
