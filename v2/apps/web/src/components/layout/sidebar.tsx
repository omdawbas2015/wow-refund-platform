'use client';

import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  ShieldCheck,
  Gift,
  Store,
  BarChart3,
  Users,
  ClipboardList,
  Globe,
  Settings,
  CreditCard,
  Mail,
} from 'lucide-react';

interface NavSection {
  label: string;
  items: NavItem[];
}
interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

export function Sidebar({ role }: { role: string | null }) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const opsRole = role === 'ADMIN' || role === 'OPERATIONS' || role === 'MANAGER';
  const sections: NavSection[] = [
    {
      label: '',
      items: [
        { label: t('dashboard'), href: '/', icon: LayoutDashboard },
        { label: t('cases'), href: '/cases', icon: FileText },
        ...(opsRole
          ? [{ label: t('operations'), href: '/operations', icon: ShieldCheck }]
          : []),
        { label: t('promo'), href: '/promo', icon: Gift },
      ],
    },
    {
      label: t('helpDesk'),
      items: [{ label: t('storesCommunication'), href: '/help-desk/stores', icon: Store }],
    },
    {
      label: t('reports'),
      items: [{ label: t('reports'), href: '/reports', icon: BarChart3 }],
    },
    {
      label: t('admin'),
      items: [
        { label: t('users'), href: '/admin/users', icon: Users, adminOnly: true },
        { label: t('pendingApprovals'), href: '/admin/pending-approvals', icon: ClipboardList, adminOnly: true },
        { label: t('countries'), href: '/admin/countries', icon: Globe, adminOnly: true },
        { label: t('paymentMethods'), href: '/admin/payment-methods', icon: CreditCard, adminOnly: true },
        { label: t('emailTemplates'), href: '/admin/email-templates', icon: Mail, adminOnly: true },
        { label: t('settings'), href: '/admin/settings', icon: Settings, adminOnly: true },
      ],
    },
  ];

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-e border-border bg-surface">
      <div className="flex h-14 items-center gap-2 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="text-sm font-semibold tracking-tight">WOW Refund</span>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-2">
        {sections.map((section, i) => {
          const items = section.items.filter((item) => !item.adminOnly || role === 'ADMIN');
          if (items.length === 0) return null;
          return (
            <div key={i} className="mb-4">
              {section.label ? (
                <div className="mb-1 px-2 text-caption uppercase text-muted-foreground">
                  {section.label}
                </div>
              ) : null}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const isActive =
                    item.href === '/' ? pathname === '/' || /^\/(en|ar)$/.test(pathname) : pathname.endsWith(item.href) || pathname.includes(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-body hover:bg-surface-subtle hover:text-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
