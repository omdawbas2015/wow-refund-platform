import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { ChangelogBanner } from '@/components/layout/changelog-banner';
import { CommandPalette } from '@/components/layout/command-palette';
import { OnboardingTour } from '@/components/layout/onboarding-tour';
import { getModuleToggleStatuses } from '@/lib/module-toggles';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { locale } = await params;
  const moduleStatuses = await getModuleToggleStatuses();
  const disabledModules = moduleStatuses.filter((m) => !m.isEnabled).map((m) => m.key);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={session.user.role ?? null} disabledModules={disabledModules} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          userName={session.user.name ?? ''}
          userEmail={session.user.email ?? ''}
          currentLocale={locale}
        />
        <ChangelogBanner />
        <main className="scrollbar-thin flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
      <CommandPalette role={session.user.role ?? null} />
      <OnboardingTour />
    </div>
  );
}
