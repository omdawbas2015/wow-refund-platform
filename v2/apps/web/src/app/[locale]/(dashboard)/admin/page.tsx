import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { auth } from '@/auth';
import { Globe, Tag, CreditCard, AlertTriangle, Mail, Users, Settings, ShieldAlert, Timer, ChevronRight } from 'lucide-react';

const SECTIONS = [
  { href: '/admin/countries', icon: Globe, title: 'Countries', desc: 'Manager email, cutoff time, sort order' },
  { href: '/admin/brands', icon: Tag, title: 'Brands', desc: 'Brand catalog and per-country mapping' },
  { href: '/admin/payment-methods', icon: CreditCard, title: 'Payment methods', desc: 'KNET, Cash, Apple Pay, …' },
  { href: '/admin/root-causes', icon: AlertTriangle, title: 'Root causes', desc: 'Why refunds happen' },
  { href: '/admin/email-templates', icon: Mail, title: 'Email templates', desc: 'Subjects, bodies, locales' },
  { href: '/admin/users', icon: Users, title: 'Users & roles', desc: 'Manage staff access' },
  { href: '/admin/pending-approvals', icon: Users, title: 'Pending signups', desc: 'Approve or reject new signups' },
  { href: '/admin/settings', icon: Settings, title: 'Settings', desc: 'Feature flags and system settings' },
  { href: '/admin/fraud-signals', icon: ShieldAlert, title: 'Fraud signals', desc: 'Heuristic alerts and detection sweeps' },
  { href: '/admin/sla-rules', icon: Timer, title: 'SLA rules', desc: 'Per-country / brand / cause SLA thresholds' },
];

export default async function AdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">Administration</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Static data, copy, and access control. Changes are audit-logged.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="block">
            <Card className="transition-colors hover:border-primary/40">
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <s.icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{s.title}</CardTitle>
                  <CardDescription>{s.desc}</CardDescription>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
