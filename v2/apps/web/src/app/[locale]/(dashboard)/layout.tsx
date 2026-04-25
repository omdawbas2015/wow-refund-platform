import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

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

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar role={session.user.role ?? null} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar
          userName={session.user.name ?? ''}
          userEmail={session.user.email ?? ''}
          currentLocale={locale}
        />
        <main className="scrollbar-thin flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
