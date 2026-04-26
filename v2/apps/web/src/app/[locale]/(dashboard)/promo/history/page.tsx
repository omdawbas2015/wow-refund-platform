import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft, History } from 'lucide-react';
import { PromoHistoryList } from './history-list';
import { PromoExportButton } from '../export-button';

const VIEW_ROLES = new Set([
  'ADMIN',
  'MANAGER',
  'OPERATIONS',
  'TEAM_LEAD',
  'AGENT',
  'READ_ONLY',
]);
const POOL_ADMIN_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS']);

export const dynamic = 'force-dynamic';

export default async function PromoHistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!VIEW_ROLES.has(session.user.role ?? '')) redirect(`/${locale}`);

  const role = session.user.role ?? '';
  const scopedToOwnRecovery = role === 'AGENT' || role === 'TEAM_LEAD';
  const canExport = POOL_ADMIN_ROLES.has(role);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/promo/allocate`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back to allocate</span>
          </Link>
        </Button>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-heading flex items-center gap-2">
            <History className="h-6 w-6 text-muted-foreground" />
            Promo history
          </h1>
          <p className="text-sm text-muted-foreground">
            Search allocations by customer, case, or code.
            {scopedToOwnRecovery && (
              <span className="ml-1 text-xs italic">
                Service-recovery allocations are scoped to ones you issued.
              </span>
            )}
          </p>
        </div>
        {canExport && <PromoExportButton />}
      </div>

      <PromoHistoryList />
    </div>
  );
}
